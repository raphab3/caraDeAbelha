package httpserver

import (
	"errors"
	"log"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
)

const worldLimit = 6

const maxUsernameLength = 24

var errInvalidUsername = errors.New("username invalido")
var errUsernameInUse = errors.New("username em uso")

type playerAction struct {
	Type string  `json:"type"`
	Dir  string  `json:"dir,omitempty"`
	X    float64 `json:"x,omitempty"`
	Z    float64 `json:"z,omitempty"`
}

type playerState struct {
	ID       string  `json:"id"`
	Username string  `json:"username"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

type sessionMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

type worldStateMessage struct {
	Type    string        `json:"type"`
	Tick    uint64        `json:"tick"`
	Players []playerState `json:"players"`
}

type clientSession struct {
	id         string
	profileKey string
	conn       *websocket.Conn
	writeMu    sync.Mutex
}

type gameHub struct {
	mu       sync.Mutex
	upgrader websocket.Upgrader
	clients  map[string]*clientSession
	players  map[string]*playerState
	profiles map[string]*playerState
	tick     uint64
}

func newGameHub() *gameHub {
	return &gameHub{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool {
				return true
			},
		},
		clients:  make(map[string]*clientSession),
		players:  make(map[string]*playerState),
		profiles: make(map[string]*playerState),
	}
}

func (hub *gameHub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	profileKey, username, err := parseUsername(r.URL.Query().Get("username"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if !hub.isUsernameAvailable(profileKey) {
		http.Error(w, errUsernameInUse.Error(), http.StatusConflict)
		return
	}

	connection, err := hub.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}

	client, initialState, err := hub.register(connection, profileKey, username)
	if err != nil {
		writeCloseMessage(connection, err.Error())
		return
	}

	hub.sendToClient(client, sessionMessage{
		Type:     "session",
		PlayerID: client.id,
		Username: username,
	})
	hub.broadcast(initialState)

	defer func() {
		_ = connection.Close()

		if state, ok := hub.unregister(client.id); ok {
			hub.broadcast(state)
		}
	}()

	for {
		var action playerAction
		if err := connection.ReadJSON(&action); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket read failed for %s: %v", client.id, err)
			}
			return
		}

		var (
			state worldStateMessage
			ok    bool
		)

		switch action.Type {
		case "move":
			state, ok = hub.movePlayer(client.id, action.Dir)
		case "move_to":
			state, ok = hub.movePlayerTo(client.id, action.X, action.Z)
		default:
			continue
		}

		if !ok {
			continue
		}

		hub.broadcast(state)
	}
}

func (hub *gameHub) register(connection *websocket.Conn, profileKey string, username string) (*clientSession, worldStateMessage, error) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	profile, ok := hub.profiles[profileKey]
	if !ok {
		spawnX, spawnY := profileSpawnPosition(profileKey)
		profile = &playerState{
			ID:       buildPlayerID(profileKey),
			Username: username,
			X:        spawnX,
			Y:        spawnY,
		}
		hub.profiles[profileKey] = profile
	}

	if _, active := hub.players[profile.ID]; active {
		return nil, worldStateMessage{}, errUsernameInUse
	}

	profile.Username = username

	client := &clientSession{
		id:         profile.ID,
		profileKey: profileKey,
		conn:       connection,
	}

	hub.clients[profile.ID] = client
	hub.players[profile.ID] = profile
	hub.tick++

	return client, hub.snapshotLocked(), nil
}

func (hub *gameHub) unregister(clientID string) (worldStateMessage, bool) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if _, ok := hub.clients[clientID]; !ok {
		return worldStateMessage{}, false
	}

	delete(hub.clients, clientID)
	delete(hub.players, clientID)
	hub.tick++

	return hub.snapshotLocked(), true
}

func (hub *gameHub) movePlayer(clientID string, direction string) (worldStateMessage, bool) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return worldStateMessage{}, false
	}

	switch direction {
	case "up":
		player.Y = clampToWorld(player.Y - 1)
	case "down":
		player.Y = clampToWorld(player.Y + 1)
	case "left":
		player.X = clampToWorld(player.X - 1)
	case "right":
		player.X = clampToWorld(player.X + 1)
	default:
		return worldStateMessage{}, false
	}

	hub.tick++

	return hub.snapshotLocked(), true
}

func (hub *gameHub) movePlayerTo(clientID string, x float64, z float64) (worldStateMessage, bool) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return worldStateMessage{}, false
	}

	player.X = clampToWorld(x)
	player.Y = clampToWorld(z)
	hub.tick++

	return hub.snapshotLocked(), true
}

func (hub *gameHub) broadcast(message worldStateMessage) {
	clients := hub.listClients()

	for _, client := range clients {
		err := hub.writeJSON(client, message)

		if err != nil {
			log.Printf("websocket write failed for %s: %v", client.id, err)
		}
	}
}

func (hub *gameHub) sendToClient(client *clientSession, message sessionMessage) {
	if err := hub.writeJSON(client, message); err != nil {
		log.Printf("websocket write failed for %s: %v", client.id, err)
	}
}

func (hub *gameHub) listClients() []*clientSession {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	clients := make([]*clientSession, 0, len(hub.clients))
	for _, client := range hub.clients {
		clients = append(clients, client)
	}

	return clients
}

func (hub *gameHub) snapshotLocked() worldStateMessage {
	players := make([]playerState, 0, len(hub.players))
	for _, player := range hub.players {
		players = append(players, *player)
	}

	sort.Slice(players, func(left int, right int) bool {
		return players[left].ID < players[right].ID
	})

	return worldStateMessage{
		Type:    "state",
		Tick:    hub.tick,
		Players: players,
	}
}

func (hub *gameHub) writeJSON(client *clientSession, message any) error {
	client.writeMu.Lock()
	defer client.writeMu.Unlock()

	return client.conn.WriteJSON(message)
}

func (hub *gameHub) isUsernameAvailable(profileKey string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	profileID := buildPlayerID(profileKey)
	_, active := hub.players[profileID]
	return !active
}

func buildPlayerID(profileKey string) string {
	return "player:" + profileKey
}

func profileSpawnPosition(profileKey string) (float64, float64) {
	spawnPoints := [][2]float64{
		{3.4, 0},
		{2.4, 2.4},
		{0, 3.4},
		{-2.4, 2.4},
		{-3.4, 0},
		{-2.4, -2.4},
		{0, -3.4},
		{2.4, -2.4},
	}

	hash := 0
	for _, char := range profileKey {
		hash += int(char)
	}

	position := spawnPoints[int(math.Abs(float64(hash)))%len(spawnPoints)]
	return position[0], position[1]
}

func parseUsername(rawUsername string) (string, string, error) {
	username := strings.Join(strings.Fields(strings.TrimSpace(rawUsername)), " ")
	if username == "" {
		return "", "", errInvalidUsername
	}

	if utf8.RuneCountInString(username) > maxUsernameLength {
		return "", "", errInvalidUsername
	}

	return strings.ToLower(username), username, nil
}

func writeCloseMessage(connection *websocket.Conn, message string) {
	deadline := time.Now().Add(time.Second)
	_ = connection.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.ClosePolicyViolation, message),
		deadline,
	)
	_ = connection.Close()
}

func clampToWorld(value float64) float64 {
	if value < -worldLimit {
		return -worldLimit
	}

	if value > worldLimit {
		return worldLimit
	}

	return value
}
