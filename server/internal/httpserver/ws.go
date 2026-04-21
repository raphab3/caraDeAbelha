package httpserver

import (
	"fmt"
	"log"
	"net/http"
	"sort"
	"sync"

	"github.com/gorilla/websocket"
)

const worldLimit = 6

type playerAction struct {
	Type string `json:"type"`
	Dir  string `json:"dir,omitempty"`
}

type playerState struct {
	ID string `json:"id"`
	X  int    `json:"x"`
	Y  int    `json:"y"`
}

type worldStateMessage struct {
	Type    string        `json:"type"`
	Tick    uint64        `json:"tick"`
	Players []playerState `json:"players"`
}

type clientSession struct {
	id      string
	conn    *websocket.Conn
	writeMu sync.Mutex
}

type gameHub struct {
	mu       sync.Mutex
	upgrader websocket.Upgrader
	clients  map[string]*clientSession
	players  map[string]*playerState
	nextID   uint64
	tick     uint64
}

func newGameHub() *gameHub {
	return &gameHub{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool {
				return true
			},
		},
		clients: make(map[string]*clientSession),
		players: make(map[string]*playerState),
	}
}

func (hub *gameHub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	connection, err := hub.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}

	client, initialState := hub.register(connection)
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

		if action.Type != "move" {
			continue
		}

		state, ok := hub.movePlayer(client.id, action.Dir)
		if !ok {
			continue
		}

		hub.broadcast(state)
	}
}

func (hub *gameHub) register(connection *websocket.Conn) (*clientSession, worldStateMessage) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	hub.nextID++
	clientID := fmt.Sprintf("p%d", hub.nextID)
	client := &clientSession{
		id:   clientID,
		conn: connection,
	}

	hub.clients[clientID] = client
	hub.players[clientID] = &playerState{ID: clientID, X: 0, Y: 0}
	hub.tick++

	return client, hub.snapshotLocked()
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

func (hub *gameHub) broadcast(message worldStateMessage) {
	clients := hub.listClients()

	for _, client := range clients {
		client.writeMu.Lock()
		err := client.conn.WriteJSON(message)
		client.writeMu.Unlock()

		if err != nil {
			log.Printf("websocket write failed for %s: %v", client.id, err)
		}
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

func clampToWorld(value int) int {
	if value < -worldLimit {
		return -worldLimit
	}

	if value > worldLimit {
		return worldLimit
	}

	return value
}
