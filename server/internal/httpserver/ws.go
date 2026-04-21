package httpserver

import (
	"errors"
	"fmt"
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

const maxUsernameLength = 24
const defaultPlayerSpeed = 3.0
const movementStopDistance = 0.08
const worldChunkSize = 4.0
const worldRenderDistance = 3
const worldTickInterval = 120 * time.Millisecond
const worldDecorationPadding = 0.55

var errInvalidUsername = errors.New("username invalido")
var errUsernameInUse = errors.New("username em uso")

var flowerPetalPalette = []string{"#fff2a1", "#ffd4ef", "#d8ffd0", "#ffe0b2", "#f6f1ff"}
var flowerCorePalette = []string{"#8d5519", "#774011", "#5f360f"}
var hiveTonePalette = []string{"#a86a18", "#b9821c", "#94611a"}
var hiveGlowPalette = []string{"#ffd96a", "#ffbf45", "#ffe89d"}

type playerAction struct {
	Type string  `json:"type"`
	Dir  string  `json:"dir,omitempty"`
	X    float64 `json:"x,omitempty"`
	Z    float64 `json:"z,omitempty"`
}

type playerState struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	TargetX   *float64  `json:"targetX,omitempty"`
	TargetY   *float64  `json:"targetY,omitempty"`
	Speed     float64   `json:"speed"`
	UpdatedAt time.Time `json:"-"`
}

type sessionMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

type worldStateMessage struct {
	Type           string            `json:"type"`
	Tick           uint64            `json:"tick"`
	Players        []playerState     `json:"players"`
	Chunks         []worldChunkState `json:"chunks"`
	CenterChunkX   int               `json:"centerChunkX"`
	CenterChunkY   int               `json:"centerChunkY"`
	RenderDistance int               `json:"renderDistance"`
	ChunkSize      float64           `json:"chunkSize"`
}

type worldFlowerState struct {
	ID         string  `json:"id"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Scale      float64 `json:"scale"`
	PetalColor string  `json:"petalColor"`
	CoreColor  string  `json:"coreColor"`
}

type worldHiveState struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Scale     float64 `json:"scale"`
	ToneColor string  `json:"toneColor"`
	GlowColor string  `json:"glowColor"`
}

type worldChunkState struct {
	Key     string             `json:"key"`
	X       int                `json:"x"`
	Y       int                `json:"y"`
	Flowers []worldFlowerState `json:"flowers"`
	Hives   []worldHiveState   `json:"hives"`
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
	now      func() time.Time
}

func newGameHub() *gameHub {
	hub := &gameHub{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool {
				return true
			},
		},
		clients:  make(map[string]*clientSession),
		players:  make(map[string]*playerState),
		profiles: make(map[string]*playerState),
		now:      time.Now,
	}

	go hub.runMovementLoop(worldTickInterval)

	return hub
}

func (hub *gameHub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	profileKey, username, err := parseUsername(r.URL.Query().Get("username"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	connection, err := hub.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}

	client, replacedClient, err := hub.register(connection, profileKey, username)
	if err != nil {
		writeCloseMessage(connection, err.Error())
		return
	}

	if replacedClient != nil {
		_ = replacedClient.conn.Close()
	}

	hub.sendToClient(client, sessionMessage{
		Type:     "session",
		PlayerID: client.id,
		Username: username,
	})
	hub.broadcast()

	defer func() {
		_ = connection.Close()

		if hub.unregister(client) {
			hub.broadcast()
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

		var ok bool

		switch action.Type {
		case "move":
			ok = hub.movePlayer(client.id, action.Dir)
		case "move_to":
			ok = hub.movePlayerTo(client.id, action.X, action.Z)
		default:
			continue
		}

		if !ok {
			continue
		}

		hub.broadcast()
	}
}

func (hub *gameHub) register(connection *websocket.Conn, profileKey string, username string) (*clientSession, *clientSession, error) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	profile, ok := hub.profiles[profileKey]
	if !ok {
		spawnX, spawnY := profileSpawnPosition(profileKey)
		profile = &playerState{
			ID:        buildPlayerID(profileKey),
			Username:  username,
			X:         spawnX,
			Y:         spawnY,
			Speed:     defaultPlayerSpeed,
			UpdatedAt: hub.now(),
		}
		hub.profiles[profileKey] = profile
	}

	hub.advancePlayerLocked(profile, hub.now())

	profile.Username = username
	replacedClient := hub.clients[profile.ID]

	client := &clientSession{
		id:         profile.ID,
		profileKey: profileKey,
		conn:       connection,
	}

	hub.clients[profile.ID] = client
	hub.players[profile.ID] = profile
	hub.tick++

	return client, replacedClient, nil
}

func (hub *gameHub) unregister(client *clientSession) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if client == nil {
		return false
	}

	current, ok := hub.clients[client.id]
	if !ok || current != client {
		return false
	}

	delete(hub.clients, client.id)
	delete(hub.players, client.id)
	hub.tick++

	return true
}

func (hub *gameHub) movePlayer(clientID string, direction string) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	nextX := player.X
	nextY := player.Y

	switch direction {
	case "up":
		nextY = clampToWorld(player.Y - 1)
	case "down":
		nextY = clampToWorld(player.Y + 1)
	case "left":
		nextX = clampToWorld(player.X - 1)
	case "right":
		nextX = clampToWorld(player.X + 1)
	default:
		return false
	}

	hub.setPlayerTargetLocked(player, nextX, nextY, now)

	hub.tick++

	return true
}

func (hub *gameHub) movePlayerTo(clientID string, x float64, z float64) bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	player, ok := hub.players[clientID]
	if !ok {
		return false
	}

	now := hub.now()
	hub.advanceActivePlayersLocked(now)
	hub.setPlayerTargetLocked(player, clampToWorld(x), clampToWorld(z), now)
	hub.tick++

	return true
}

type clientSnapshot struct {
	client  *clientSession
	message worldStateMessage
}

func (hub *gameHub) broadcast() {
	snapshots := hub.collectClientSnapshots()

	for _, snapshot := range snapshots {
		err := hub.writeJSON(snapshot.client, snapshot.message)

		if err != nil {
			log.Printf("websocket write failed for %s: %v", snapshot.client.id, err)
		}
	}
}

func (hub *gameHub) sendToClient(client *clientSession, message sessionMessage) {
	if err := hub.writeJSON(client, message); err != nil {
		log.Printf("websocket write failed for %s: %v", client.id, err)
	}
}

func (hub *gameHub) collectClientSnapshots() []clientSnapshot {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	snapshots := make([]clientSnapshot, 0, len(hub.clients))
	for _, client := range hub.clients {
		viewer := hub.players[client.id]
		if viewer == nil {
			continue
		}

		snapshots = append(snapshots, clientSnapshot{
			client:  client,
			message: hub.snapshotForPlayerLocked(viewer),
		})
	}

	return snapshots
}

func (hub *gameHub) snapshotForPlayerLocked(viewer *playerState) worldStateMessage {
	centerChunkX, centerChunkY := playerChunkPosition(viewer)

	// Todos os jogadores são sempre incluídos — o cliente filtra por distância para o render 3D
	players := make([]playerState, 0, len(hub.players))
	for _, player := range hub.players {
		players = append(players, *player)
	}

	sort.Slice(players, func(left int, right int) bool {
		return players[left].ID < players[right].ID
	})

	chunks := visibleChunksAround(centerChunkX, centerChunkY)

	return worldStateMessage{
		Type:           "state",
		Tick:           hub.tick,
		Players:        players,
		Chunks:         chunks,
		CenterChunkX:   centerChunkX,
		CenterChunkY:   centerChunkY,
		RenderDistance: worldRenderDistance,
		ChunkSize:      worldChunkSize,
	}
}

func (hub *gameHub) writeJSON(client *clientSession, message any) error {
	client.writeMu.Lock()
	defer client.writeMu.Unlock()

	return client.conn.WriteJSON(message)
}

func buildPlayerID(profileKey string) string {
	return "player:" + profileKey
}

func buildChunkKey(chunkX int, chunkY int) string {
	return fmt.Sprintf("chunk:%d:%d", chunkX, chunkY)
}

func (hub *gameHub) advanceActivePlayersLocked(now time.Time) {
	for _, player := range hub.players {
		hub.advancePlayerLocked(player, now)
	}
}

func (hub *gameHub) stepMovingPlayers() bool {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if len(hub.players) == 0 {
		return false
	}

	now := hub.now()
	changed := false
	for _, player := range hub.players {
		if hub.advancePlayerLocked(player, now) {
			changed = true
		}
	}

	if !changed {
		return false
	}

	hub.tick++
	return true
}

func (hub *gameHub) runMovementLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		if !hub.stepMovingPlayers() {
			continue
		}

		hub.broadcast()
	}
}

func (hub *gameHub) advancePlayerLocked(player *playerState, now time.Time) bool {
	if player == nil {
		return false
	}

	if player.UpdatedAt.IsZero() {
		player.UpdatedAt = now
		return false
	}

	if player.TargetX == nil || player.TargetY == nil {
		player.UpdatedAt = now
		return false
	}

	elapsed := now.Sub(player.UpdatedAt).Seconds()
	if elapsed <= 0 {
		return false
	}

	deltaX := *player.TargetX - player.X
	deltaY := *player.TargetY - player.Y
	distance := math.Hypot(deltaX, deltaY)

	if distance <= movementStopDistance {
		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	stepDistance := player.Speed * elapsed
	if stepDistance >= distance {
		player.X = *player.TargetX
		player.Y = *player.TargetY
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return true
	}

	ratio := stepDistance / distance
	player.X += deltaX * ratio
	player.Y += deltaY * ratio
	player.UpdatedAt = now
	return true
}

func (hub *gameHub) setPlayerTargetLocked(player *playerState, x float64, y float64, now time.Time) {
	if player == nil {
		return
	}

	if math.Abs(player.X-x) <= movementStopDistance && math.Abs(player.Y-y) <= movementStopDistance {
		player.X = x
		player.Y = y
		player.TargetX = nil
		player.TargetY = nil
		player.UpdatedAt = now
		return
	}

	player.TargetX = &x
	player.TargetY = &y
	player.UpdatedAt = now
}

func playerChunkPosition(player *playerState) (int, int) {
	if player == nil {
		return 0, 0
	}

	return worldAxisToChunk(player.X), worldAxisToChunk(player.Y)
}

func worldAxisToChunk(value float64) int {
	return int(math.Floor(value / worldChunkSize))
}

func isChunkWithinDistance(centerChunkX int, centerChunkY int, chunkX int, chunkY int, distance int) bool {
	return absInt(centerChunkX-chunkX) <= distance && absInt(centerChunkY-chunkY) <= distance
}

func visibleChunksAround(centerChunkX int, centerChunkY int) []worldChunkState {
	chunks := make([]worldChunkState, 0, (worldRenderDistance*2+1)*(worldRenderDistance*2+1))

	for chunkY := centerChunkY - worldRenderDistance; chunkY <= centerChunkY+worldRenderDistance; chunkY++ {
		for chunkX := centerChunkX - worldRenderDistance; chunkX <= centerChunkX+worldRenderDistance; chunkX++ {
			chunks = append(chunks, buildChunkState(chunkX, chunkY))
		}
	}

	return chunks
}

func buildChunkState(chunkX int, chunkY int) worldChunkState {
	originX := float64(chunkX) * worldChunkSize
	originY := float64(chunkY) * worldChunkSize
	flowerCount := 3 + positiveModulo(int(hashUint32(chunkX, chunkY, 1)), 3)
	flowers := make([]worldFlowerState, 0, flowerCount)

	for index := 0; index < flowerCount; index++ {
		flowers = append(flowers, worldFlowerState{
			ID:         fmt.Sprintf("flower:%d:%d:%d", chunkX, chunkY, index),
			X:          originX + hashRange(worldDecorationPadding, worldChunkSize-worldDecorationPadding, chunkX, chunkY, index, 11),
			Y:          originY + hashRange(worldDecorationPadding, worldChunkSize-worldDecorationPadding, chunkX, chunkY, index, 23),
			Scale:      hashRange(0.72, 1.28, chunkX, chunkY, index, 37),
			PetalColor: flowerPetalPalette[positiveModulo(int(hashUint32(chunkX, chunkY, index, 41)), len(flowerPetalPalette))],
			CoreColor:  flowerCorePalette[positiveModulo(int(hashUint32(chunkX, chunkY, index, 53)), len(flowerCorePalette))],
		})
	}

	hives := make([]worldHiveState, 0, 1)
	if positiveModulo(int(hashUint32(chunkX, chunkY, 97)), 4) == 0 {
		hives = append(hives, worldHiveState{
			ID:        fmt.Sprintf("hive:%d:%d", chunkX, chunkY),
			X:         originX + hashRange(worldChunkSize*0.24, worldChunkSize*0.76, chunkX, chunkY, 0, 101),
			Y:         originY + hashRange(worldChunkSize*0.24, worldChunkSize*0.76, chunkX, chunkY, 0, 131),
			Scale:     hashRange(0.92, 1.24, chunkX, chunkY, 0, 151),
			ToneColor: hiveTonePalette[positiveModulo(int(hashUint32(chunkX, chunkY, 0, 163)), len(hiveTonePalette))],
			GlowColor: hiveGlowPalette[positiveModulo(int(hashUint32(chunkX, chunkY, 0, 173)), len(hiveGlowPalette))],
		})
	}

	return worldChunkState{
		Key:     buildChunkKey(chunkX, chunkY),
		X:       chunkX,
		Y:       chunkY,
		Flowers: flowers,
		Hives:   hives,
	}
}

func hashUint32(parts ...int) uint32 {
	hash := uint32(2166136261)
	const prime uint32 = 16777619

	for _, part := range parts {
		value := uint32(int32(part)) + 0x9e3779b9
		hash ^= value
		hash *= prime
	}

	return hash
}

func hashRange(min float64, max float64, parts ...int) float64 {
	if max <= min {
		return min
	}

	return min + hashUnit(parts...)*(max-min)
}

func hashUnit(parts ...int) float64 {
	return float64(hashUint32(parts...)%10000) / 9999
}

func positiveModulo(value int, divisor int) int {
	remainder := value % divisor
	if remainder < 0 {
		return remainder + divisor
	}

	return remainder
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}

	return value
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
	return value
}
