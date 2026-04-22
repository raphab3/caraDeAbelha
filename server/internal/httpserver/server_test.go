package httpserver

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

func openGameSocket(t *testing.T, websocketURL string, username string) *websocket.Conn {
	t.Helper()

	requestURL, err := url.Parse(websocketURL)
	if err != nil {
		t.Fatalf("parse websocket url: %v", err)
	}

	if username != "" {
		query := requestURL.Query()
		query.Set("username", username)
		requestURL.RawQuery = query.Encode()
	}

	connection, _, err := websocket.DefaultDialer.Dial(requestURL.String(), nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}

	if err := connection.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}

	return connection
}

func buildTraversableTestWorld() worldLayout {
	return worldLayout{
		chunks: map[string]worldChunkState{
			buildChunkKey(0, 0): {
				Key: buildChunkKey(0, 0),
				Tiles: []worldTileState{
					{ID: "tile:0:0", X: 0.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:1:0", X: 1.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:2:0", X: 2.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:3:0", X: 3.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:0:1", X: 0.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:1:1", X: 1.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:2:1", X: 2.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:3:1", X: 3.5, Y: 0, Z: 1.5, Type: "grass"},
				},
			},
			buildChunkKey(1, 0): {
				Key: buildChunkKey(1, 0),
				Tiles: []worldTileState{
					{ID: "tile:4:0", X: 4.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:5:0", X: 5.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:4:1", X: 4.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:5:1", X: 5.5, Y: 0, Z: 1.5, Type: "grass"},
				},
			},
		},
		hasBounds: true,
		minX:      0.5,
		maxX:      5.5,
		minY:      0.5,
		maxY:      1.5,
	}
}

func TestMovePlayerToCompressesReturnFromOutlands(t *testing.T) {
	hub := newRuntimeTestHub(time.Date(2026, time.April, 23, 10, 0, 0, 0, time.UTC))
	hub.world = worldLayout{
		chunks: map[string]worldChunkState{
			buildChunkKey(10, 0): {
				Key: buildChunkKey(10, 0),
				Tiles: []worldTileState{
					{ID: "tile:40:0", X: 40.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:40:1", X: 40.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:41:0", X: 41.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:41:1", X: 41.5, Y: 0, Z: 1.5, Type: "grass"},
				},
			},
		},
		hasBounds: true,
		minX:      40.5,
		maxX:      41.5,
		minY:      0.5,
		maxY:      1.5,
	}
	hub.world.edgeBehavior = &worldEdgeBehavior{
		Type:           "outlands_return_corridor",
		PlayableBounds: worldBounds{X1: -45, X2: 45, Z1: -45, Z2: 45},
		OutlandsBounds: worldBounds{X1: -120, X2: 120, Z1: -120, Z2: 120},
	}

	player := &playerState{
		ID:       "player:scout",
		Username: "Scout",
		X:        110,
		Y:        0,
	}
	hub.players[player.ID] = player

	hub.movePlayerTo(player.ID, 40, 0)

	if player.X >= 110 || player.X <= 45 {
		t.Fatalf("expected player x to be compressed toward the playable edge, got %v", player.X)
	}

	if player.TargetX == nil || player.TargetY == nil {
		t.Fatalf("expected movePlayerTo to set a target")
	}

	if math.Abs(*player.TargetX-40) > 0.001 || math.Abs(*player.TargetY) > 0.001 {
		t.Fatalf("expected target to remain inside the playable area at 40,0, got %v,%v", *player.TargetX, *player.TargetY)
	}
}

func TestMovePlayerToRejectsMountainTile(t *testing.T) {
	hub := newGameHub()
	hub.world = worldLayout{
		chunks: map[string]worldChunkState{
			buildChunkKey(0, 0): {
				Key: buildChunkKey(0, 0),
				Tiles: []worldTileState{
					{ID: "tile:0:0", X: 0.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:1:0", X: 1.5, Y: 1, Z: 0.5, Type: "stone"},
					{ID: "tile:0:1", X: 0.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:1:1", X: 1.5, Y: 0, Z: 1.5, Type: "grass"},
				},
			},
		},
		hasBounds: true,
		minX:      0.5,
		maxX:      1.5,
		minY:      0.5,
		maxY:      1.5,
	}

	player := &playerState{ID: "player:test", Username: "test", X: 0.5, Y: 0.5, Speed: defaultPlayerSpeed}
	hub.players[player.ID] = player

	if ok := hub.movePlayerTo(player.ID, 1.5, 0.5); ok {
		t.Fatalf("expected movePlayerTo to reject a mountain tile target")
	}

	if player.TargetX != nil || player.TargetY != nil {
		t.Fatalf("expected rejected mountain target to leave no active movement target")
	}

	if math.Abs(player.X-0.5) > 0.001 || math.Abs(player.Y-0.5) > 0.001 {
		t.Fatalf("expected player to remain at the original position, got %.2f,%.2f", player.X, player.Y)
	}
}

func TestMovePlayerToAllowsWaterTile(t *testing.T) {
	hub := newGameHub()
	hub.world = worldLayout{
		chunks: map[string]worldChunkState{
			buildChunkKey(0, 0): {
				Key: buildChunkKey(0, 0),
				Tiles: []worldTileState{
					{ID: "tile:0:0", X: 0.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:1:0", X: 1.5, Y: 0, Z: 0.5, Type: "water"},
					{ID: "tile:0:1", X: 0.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:1:1", X: 1.5, Y: 0, Z: 1.5, Type: "grass"},
				},
			},
		},
		hasBounds: true,
		minX:      0.5,
		maxX:      1.5,
		minY:      0.5,
		maxY:      1.5,
	}

	player := &playerState{ID: "player:test", Username: "test", X: 0.5, Y: 0.5, Speed: defaultPlayerSpeed}
	hub.players[player.ID] = player

	if ok := hub.movePlayerTo(player.ID, 1.5, 0.5); !ok {
		t.Fatalf("expected movePlayerTo to allow water tile traversal")
	}

	if player.TargetX == nil || player.TargetY == nil {
		t.Fatalf("expected water traversal to set a movement target")
	}

	if math.Abs(*player.TargetX-1.5) > 0.001 || math.Abs(*player.TargetY-0.5) > 0.001 {
		t.Fatalf("expected water traversal target 1.5,0.5, got %.2f,%.2f", *player.TargetX, *player.TargetY)
	}
}

func TestMovePlayerToRejectsLockedZoneTarget(t *testing.T) {
	hub := newGameHub()
	hub.world = buildTraversableTestWorld()
	hub.world.zones = []worldZone{
		{ID: zones.StarterMeadowZoneID, X1: 0.5, X2: 2.99, Z1: 0.5, Z2: 1.5},
		{ID: zones.SunflowerRidgeZoneID, X1: 3.0, X2: 5.5, Z1: 0.5, Z2: 1.5},
	}

	player := &playerState{ID: "player:test", Username: "test", X: 0.5, Y: 0.5, Speed: defaultPlayerSpeed}
	hub.players[player.ID] = player
	hub.ensurePlayerProgressLocked(player.ID)

	if ok := hub.movePlayerTo(player.ID, 4.5, 0.5); ok {
		t.Fatalf("expected movePlayerTo to reject locked zone traversal")
	}

	if player.TargetX != nil || player.TargetY != nil {
		t.Fatalf("expected locked zone rejection to leave no active target")
	}
}

func TestHealthcheck(t *testing.T) {
	handler := NewHandler()
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("expected application/json content type, got %q", contentType)
	}

	if allowOrigin := recorder.Header().Get("Access-Control-Allow-Origin"); allowOrigin != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin header '*', got %q", allowOrigin)
	}
}

func TestOptionsRequestReturnsCORSHeaders(t *testing.T) {
	handler := NewHandler()
	request := httptest.NewRequest(http.MethodOptions, "/healthz", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}

	if allowOrigin := recorder.Header().Get("Access-Control-Allow-Origin"); allowOrigin != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin header '*', got %q", allowOrigin)
	}
}

func TestMetricsReportsActivePlayers(t *testing.T) {
	handler := NewHandler()
	testServer := httptest.NewServer(handler)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	firstConnection := openGameSocket(t, websocketURL, "scout")
	defer firstConnection.Close()

	var firstSession sessionMessage
	if err := firstConnection.ReadJSON(&firstSession); err != nil {
		t.Fatalf("read first session: %v", err)
	}

	var firstState worldStateMessage
	if err := firstConnection.ReadJSON(&firstState); err != nil {
		t.Fatalf("read first state: %v", err)
	}

	secondConnection := openGameSocket(t, websocketURL, "guard")
	defer secondConnection.Close()

	var secondSession sessionMessage
	if err := secondConnection.ReadJSON(&secondSession); err != nil {
		t.Fatalf("read second session: %v", err)
	}

	var secondState worldStateMessage
	if err := secondConnection.ReadJSON(&secondState); err != nil {
		t.Fatalf("read second state: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	var response metricsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode metrics response: %v", err)
	}

	if response.ActivePlayers != 2 {
		t.Fatalf("expected two active players, got %d", response.ActivePlayers)
	}

	if response.Service != "cara-de-abelha-server" {
		t.Fatalf("expected service cara-de-abelha-server, got %q", response.Service)
	}
}

func TestAdminPlayersEndpointReturnsPaginatedOnlineFirst(t *testing.T) {
	baseTime := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	hub := &gameHub{
		clients: map[string]*clientSession{
			"player:alpha": {
				id:         "player:alpha",
				profileKey: "alpha",
			},
			"player:beta": {
				id:         "player:beta",
				profileKey: "beta",
			},
		},
		players: map[string]*playerState{
			"player:alpha": {ID: "player:alpha"},
			"player:beta":  {ID: "player:beta"},
		},
		profiles: map[string]*playerState{
			"alpha": {
				ID:         "player:alpha",
				Username:   "Alpha",
				LastSeenAt: baseTime.Add(-time.Minute),
			},
			"beta": {
				ID:         "player:beta",
				Username:   "Beta",
				LastSeenAt: baseTime.Add(-3 * time.Minute),
			},
			"zeta": {
				ID:         "player:zeta",
				Username:   "Zeta",
				LastSeenAt: baseTime.Add(-20 * time.Second),
			},
		},
		world: loadWorldLayout(),
		now: func() time.Time {
			return baseTime
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/admin/players", hub.handleAdminPlayers)
	testServer := httptest.NewServer(mux)
	defer testServer.Close()

	response, err := http.Get(testServer.URL + "/admin/players?page=1&pageSize=2")
	if err != nil {
		t.Fatalf("request admin players: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.StatusCode)
	}

	var payload adminPlayersResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("decode admin players response: %v", err)
	}

	if payload.Total != 3 {
		t.Fatalf("expected total 3, got %d", payload.Total)
	}

	if payload.TotalPages != 2 {
		t.Fatalf("expected totalPages 2, got %d", payload.TotalPages)
	}

	if len(payload.Players) != 2 {
		t.Fatalf("expected 2 players on first page, got %d", len(payload.Players))
	}

	if payload.Players[0].Username != "Alpha" || !payload.Players[0].Online {
		t.Fatalf("expected Alpha online first, got %+v", payload.Players[0])
	}

	if payload.Players[1].Username != "Beta" || !payload.Players[1].Online {
		t.Fatalf("expected Beta online second, got %+v", payload.Players[1])
	}

	responsePageTwo, err := http.Get(testServer.URL + "/admin/players?page=2&pageSize=2")
	if err != nil {
		t.Fatalf("request admin players page two: %v", err)
	}
	defer responsePageTwo.Body.Close()

	var payloadPageTwo adminPlayersResponse
	if err := json.NewDecoder(responsePageTwo.Body).Decode(&payloadPageTwo); err != nil {
		t.Fatalf("decode admin players page two: %v", err)
	}

	if len(payloadPageTwo.Players) != 1 {
		t.Fatalf("expected 1 player on second page, got %d", len(payloadPageTwo.Players))
	}

	if payloadPageTwo.Players[0].Username != "Zeta" || payloadPageTwo.Players[0].Online {
		t.Fatalf("expected offline Zeta on second page, got %+v", payloadPageTwo.Players[0])
	}
}

func TestWebSocketMoveBroadcastsState(t *testing.T) {
	handler := NewHandler()
	testServer := httptest.NewServer(handler)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	connection := openGameSocket(t, websocketURL, "scout")
	defer connection.Close()

	var session sessionMessage
	if err := connection.ReadJSON(&session); err != nil {
		t.Fatalf("read session: %v", err)
	}

	if session.Type != "session" {
		t.Fatalf("expected session message, got %q", session.Type)
	}

	if session.PlayerID == "" {
		t.Fatalf("expected non-empty player id")
	}

	if session.Username != "scout" {
		t.Fatalf("expected session username scout, got %q", session.Username)
	}

	var initialState worldStateMessage
	if err := connection.ReadJSON(&initialState); err != nil {
		t.Fatalf("read initial state: %v", err)
	}

	if initialState.Type != "state" {
		t.Fatalf("expected state message, got %q", initialState.Type)
	}

	if len(initialState.Players) != 1 {
		t.Fatalf("expected one player in initial state, got %d", len(initialState.Players))
	}

	if initialState.Players[0].ID != session.PlayerID {
		t.Fatalf("expected initial state player id %q, got %q", session.PlayerID, initialState.Players[0].ID)
	}

	if initialState.Players[0].Username != session.Username {
		t.Fatalf("expected initial state username %q, got %q", session.Username, initialState.Players[0].Username)
	}

	expectedSpawnX, expectedSpawnY := profileSpawnPosition("scout")

	if initialState.Players[0].X != expectedSpawnX || initialState.Players[0].Y != expectedSpawnY {
		t.Fatalf("expected initial position %.1f,%.1f, got %.1f,%.1f", expectedSpawnX, expectedSpawnY, initialState.Players[0].X, initialState.Players[0].Y)
	}

	if err := connection.WriteJSON(playerAction{Type: "move", Dir: "right"}); err != nil {
		t.Fatalf("send move action: %v", err)
	}

	var updatedState worldStateMessage
	if err := connection.ReadJSON(&updatedState); err != nil {
		t.Fatalf("read updated state: %v", err)
	}

	if updatedState.Tick <= initialState.Tick {
		t.Fatalf("expected updated tick greater than %d, got %d", initialState.Tick, updatedState.Tick)
	}

	if len(updatedState.Players) != 1 {
		t.Fatalf("expected one player in updated state, got %d", len(updatedState.Players))
	}

	if math.Abs(updatedState.Players[0].X-expectedSpawnX) > 0.001 || math.Abs(updatedState.Players[0].Y-expectedSpawnY) > 0.001 {
		t.Fatalf("expected move to preserve current position %.1f,%.1f, got %.1f,%.1f", expectedSpawnX, expectedSpawnY, updatedState.Players[0].X, updatedState.Players[0].Y)
	}

	if updatedState.Players[0].TargetX == nil || updatedState.Players[0].TargetY == nil {
		t.Fatalf("expected keyboard move target to be present in world state")
	}

	expectedTargetX := clampToWorld(expectedSpawnX + 1)
	if math.Abs(*updatedState.Players[0].TargetX-expectedTargetX) > 0.001 || math.Abs(*updatedState.Players[0].TargetY-expectedSpawnY) > 0.001 {
		t.Fatalf("expected keyboard move target %.1f,%.1f, got %.1f,%.1f", expectedTargetX, expectedSpawnY, *updatedState.Players[0].TargetX, *updatedState.Players[0].TargetY)
	}

	if updatedState.Players[0].Speed != defaultPlayerSpeed {
		t.Fatalf("expected default player speed %.1f, got %.1f", defaultPlayerSpeed, updatedState.Players[0].Speed)
	}
}

func TestWebSocketMoveToBroadcastsState(t *testing.T) {
	handler := NewHandler()
	testServer := httptest.NewServer(handler)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	connection := openGameSocket(t, websocketURL, "cursor")
	defer connection.Close()

	var session sessionMessage
	if err := connection.ReadJSON(&session); err != nil {
		t.Fatalf("read session: %v", err)
	}

	var initialState worldStateMessage
	if err := connection.ReadJSON(&initialState); err != nil {
		t.Fatalf("read initial state: %v", err)
	}

	if err := connection.WriteJSON(playerAction{Type: "move_to", X: 2.5, Z: -1.5}); err != nil {
		t.Fatalf("send move_to action: %v", err)
	}

	var updatedState worldStateMessage
	if err := connection.ReadJSON(&updatedState); err != nil {
		t.Fatalf("read updated state: %v", err)
	}

	if updatedState.Tick <= initialState.Tick {
		t.Fatalf("expected updated tick greater than %d, got %d", initialState.Tick, updatedState.Tick)
	}

	if len(updatedState.Players) != 1 {
		t.Fatalf("expected one player in updated state, got %d", len(updatedState.Players))
	}

	if updatedState.Players[0].ID != session.PlayerID {
		t.Fatalf("expected player id %q, got %q", session.PlayerID, updatedState.Players[0].ID)
	}

	if math.Abs(updatedState.Players[0].X-initialState.Players[0].X) > 0.001 || math.Abs(updatedState.Players[0].Y-initialState.Players[0].Y) > 0.001 {
		t.Fatalf("expected move_to to preserve current position %.1f,%.1f, got %.1f,%.1f", initialState.Players[0].X, initialState.Players[0].Y, updatedState.Players[0].X, updatedState.Players[0].Y)
	}

	if updatedState.Players[0].TargetX == nil || updatedState.Players[0].TargetY == nil {
		t.Fatalf("expected move_to target to be present in world state")
	}

	if math.Abs(*updatedState.Players[0].TargetX-2.5) > 0.001 || math.Abs(*updatedState.Players[0].TargetY+1.5) > 0.001 {
		t.Fatalf("expected move_to target 2.5,-1.5, got %.1f,%.1f", *updatedState.Players[0].TargetX, *updatedState.Players[0].TargetY)
	}

	if updatedState.Players[0].Speed != defaultPlayerSpeed {
		t.Fatalf("expected default player speed %.1f, got %.1f", defaultPlayerSpeed, updatedState.Players[0].Speed)
	}
}

func TestRespawnPlayerReturnsToProfileSpawn(t *testing.T) {
	hub := newGameHub()
	baseTime := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	targetX := 8.0
	targetY := -6.0
	playerID := buildPlayerID("beekeeper")
	player := &playerState{
		ID:        playerID,
		Username:  "beekeeper",
		X:         11.0,
		Y:         -9.0,
		TargetX:   &targetX,
		TargetY:   &targetY,
		Speed:     defaultPlayerSpeed,
		UpdatedAt: baseTime.Add(-time.Second),
	}

	hub.players[playerID] = player
	hub.profiles["beekeeper"] = player
	hub.clients[playerID] = &clientSession{
		id:         playerID,
		profileKey: "beekeeper",
	}
	hub.now = func() time.Time {
		return baseTime
	}

	if ok := hub.respawnPlayer(playerID); !ok {
		t.Fatalf("expected respawn to succeed")
	}

	expectedSpawnX, expectedSpawnY := profileSpawnPosition("beekeeper")
	if math.Abs(player.X-expectedSpawnX) > 0.001 || math.Abs(player.Y-expectedSpawnY) > 0.001 {
		t.Fatalf("expected respawn position %.1f,%.1f, got %.1f,%.1f", expectedSpawnX, expectedSpawnY, player.X, player.Y)
	}

	if player.TargetX != nil || player.TargetY != nil {
		t.Fatalf("expected respawn to clear active target")
	}

	if !player.UpdatedAt.Equal(baseTime) {
		t.Fatalf("expected updatedAt %v, got %v", baseTime, player.UpdatedAt)
	}

	if hub.tick != 1 {
		t.Fatalf("expected tick 1 after respawn, got %d", hub.tick)
	}
}

func TestUnregisterRemovesActivePlayerButKeepsProfile(t *testing.T) {
	player := &playerState{ID: "player:beekeeper", Username: "beekeeper"}
	client := &clientSession{id: player.ID, profileKey: "beekeeper"}
	hub := &gameHub{
		clients: map[string]*clientSession{
			player.ID: client,
		},
		players: map[string]*playerState{
			player.ID: player,
		},
		profiles: map[string]*playerState{
			"beekeeper": player,
		},
	}

	if ok := hub.unregister(client); !ok {
		t.Fatalf("expected unregister to remove the active client")
	}

	if _, ok := hub.clients[player.ID]; ok {
		t.Fatalf("expected client to be removed from active clients")
	}

	if _, ok := hub.players[player.ID]; ok {
		t.Fatalf("expected player to be removed from active players")
	}

	if profile := hub.profiles[client.profileKey]; profile != player {
		t.Fatalf("expected profile for %q to remain available after disconnect", client.profileKey)
	}
}

func TestWebSocketTimeoutRemovesPlayerButKeepsProfile(t *testing.T) {
	hub := newGameHub()
	hub.pongWait = 180 * time.Millisecond
	hub.pingPeriod = 60 * time.Millisecond
	hub.writeWait = 80 * time.Millisecond

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", hub.handleWebSocket)
	testServer := httptest.NewServer(mux)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	connection := openGameSocket(t, websocketURL, "idlebee")
	defer connection.Close()

	var session sessionMessage
	if err := connection.ReadJSON(&session); err != nil {
		t.Fatalf("read session: %v", err)
	}

	var initialState worldStateMessage
	if err := connection.ReadJSON(&initialState); err != nil {
		t.Fatalf("read initial state: %v", err)
	}

	hub.mu.Lock()
	player := hub.players[session.PlayerID]
	targetX := player.X + 1
	targetY := player.Y
	player.TargetX = &targetX
	player.TargetY = &targetY
	hub.mu.Unlock()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		hub.mu.Lock()
		_, clientStillConnected := hub.clients[session.PlayerID]
		_, playerStillActive := hub.players[session.PlayerID]
		profile := hub.profiles["idlebee"]
		hub.mu.Unlock()

		if !clientStillConnected && !playerStillActive {
			if profile == nil {
				t.Fatalf("expected profile to remain available for reconnect")
			}

			if profile.TargetX == nil || profile.TargetY == nil {
				t.Fatalf("expected stored profile target to remain available after timeout")
			}

			return
		}

		time.Sleep(20 * time.Millisecond)
	}

	t.Fatalf("expected websocket timeout to remove player from active maps")
}

func TestWebSocketRespawnBroadcastsState(t *testing.T) {
	hub := newGameHub()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", hub.handleWebSocket)
	testServer := httptest.NewServer(mux)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	connection := openGameSocket(t, websocketURL, "beekeeper")
	defer connection.Close()

	var session sessionMessage
	if err := connection.ReadJSON(&session); err != nil {
		t.Fatalf("read session: %v", err)
	}

	var initialState worldStateMessage
	if err := connection.ReadJSON(&initialState); err != nil {
		t.Fatalf("read initial state: %v", err)
	}

	hub.mu.Lock()
	player := hub.players[session.PlayerID]
	targetX := 14.0
	targetY := -11.0
	player.X = 9.5
	player.Y = -8.0
	player.TargetX = &targetX
	player.TargetY = &targetY
	hub.mu.Unlock()

	if err := connection.WriteJSON(playerAction{Type: "respawn"}); err != nil {
		t.Fatalf("send respawn action: %v", err)
	}

	var updatedState worldStateMessage
	if err := connection.ReadJSON(&updatedState); err != nil {
		t.Fatalf("read updated state: %v", err)
	}

	if updatedState.Tick <= initialState.Tick {
		t.Fatalf("expected updated tick greater than %d, got %d", initialState.Tick, updatedState.Tick)
	}

	if len(updatedState.Players) != 1 {
		t.Fatalf("expected one player in updated state, got %d", len(updatedState.Players))
	}

	expectedSpawnX, expectedSpawnY := profileSpawnPosition("beekeeper")
	if math.Abs(updatedState.Players[0].X-expectedSpawnX) > 0.001 || math.Abs(updatedState.Players[0].Y-expectedSpawnY) > 0.001 {
		t.Fatalf("expected respawn position %.1f,%.1f, got %.1f,%.1f", expectedSpawnX, expectedSpawnY, updatedState.Players[0].X, updatedState.Players[0].Y)
	}

	if updatedState.Players[0].TargetX != nil || updatedState.Players[0].TargetY != nil {
		t.Fatalf("expected respawn snapshot to clear active target")
	}
}

func TestAdvancePlayerLockedMovesTowardTargetAtConstantSpeed(t *testing.T) {
	hub := newGameHub()
	hub.world = buildTraversableTestWorld()
	baseTime := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	targetX := 3.5
	targetY := 0.5
	player := &playerState{
		ID:        "player:test",
		Username:  "test",
		X:         0.5,
		Y:         0.5,
		TargetX:   &targetX,
		TargetY:   &targetY,
		Speed:     2,
		UpdatedAt: baseTime,
	}

	hub.advancePlayerLocked(player, baseTime.Add(500*time.Millisecond))

	if math.Abs(player.X-1.5) > 0.001 || math.Abs(player.Y-0.5) > 0.001 {
		t.Fatalf("expected player to advance to 1.5,0.5 after 0.5s, got %.3f,%.3f", player.X, player.Y)
	}

	if player.TargetX == nil || player.TargetY == nil {
		t.Fatalf("expected player target to remain active mid-journey")
	}

	hub.advancePlayerLocked(player, baseTime.Add(1500*time.Millisecond))

	if math.Abs(player.X-3.5) > 0.001 || math.Abs(player.Y-0.5) > 0.001 {
		t.Fatalf("expected player to reach 3.5,0.5 after 1.5s, got %.3f,%.3f", player.X, player.Y)
	}

	if player.TargetX != nil || player.TargetY != nil {
		t.Fatalf("expected player target to clear on arrival")
	}
}

func TestAdvancePlayerLockedStopsBeforeBlockedMountain(t *testing.T) {
	hub := newGameHub()
	hub.world = worldLayout{
		chunks: map[string]worldChunkState{
			buildChunkKey(0, 0): {
				Key: buildChunkKey(0, 0),
				Tiles: []worldTileState{
					{ID: "tile:0:0", X: 0.5, Y: 0, Z: 0.5, Type: "grass"},
					{ID: "tile:1:0", X: 1.5, Y: 1, Z: 0.5, Type: "stone"},
					{ID: "tile:0:1", X: 0.5, Y: 0, Z: 1.5, Type: "grass"},
					{ID: "tile:1:1", X: 1.5, Y: 0, Z: 1.5, Type: "grass"},
				},
			},
		},
		hasBounds: true,
		minX:      0.5,
		maxX:      1.5,
		minY:      0.5,
		maxY:      1.5,
	}

	baseTime := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	targetX := 1.5
	targetY := 0.5
	player := &playerState{
		ID:        "player:test",
		Username:  "test",
		X:         0.5,
		Y:         0.5,
		TargetX:   &targetX,
		TargetY:   &targetY,
		Speed:     2,
		UpdatedAt: baseTime,
	}

	if changed := hub.advancePlayerLocked(player, baseTime.Add(500*time.Millisecond)); !changed {
		t.Fatalf("expected movement attempt to update player state by cancelling blocked travel")
	}

	if player.TargetX != nil || player.TargetY != nil {
		t.Fatalf("expected blocked mountain path to clear the active target")
	}

	if math.Abs(player.X-0.5) > 0.001 || math.Abs(player.Y-0.5) > 0.001 {
		t.Fatalf("expected player to stay before the blocked mountain tile, got %.2f,%.2f", player.X, player.Y)
	}
}

func TestAdvancePlayerLockedRespawnsPlayerFromLockedZone(t *testing.T) {
	hub := newGameHub()
	hub.world = buildTraversableTestWorld()
	hub.world.zones = []worldZone{
		{ID: zones.StarterMeadowZoneID, X1: 0.5, X2: 2.99, Z1: 0.5, Z2: 1.5},
		{ID: zones.SunflowerRidgeZoneID, X1: 3.0, X2: 5.5, Z1: 0.5, Z2: 1.5},
	}

	baseTime := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	player := &playerState{
		ID:        "player:c",
		Username:  "c",
		X:         4.5,
		Y:         0.5,
		Speed:     defaultPlayerSpeed,
		UpdatedAt: baseTime,
	}
	progress := hub.ensurePlayerProgressLocked(player.ID)

	if changed := hub.advancePlayerLocked(player, baseTime.Add(500*time.Millisecond)); !changed {
		t.Fatalf("expected locked-zone recovery to update the player state")
	}

	if player.X > 2.99 {
		t.Fatalf("expected player to be moved back into an unlocked zone, got %.2f,%.2f", player.X, player.Y)
	}

	if progress.CurrentZoneID != zones.StarterMeadowZoneID {
		t.Fatalf("expected recovered player zone %q, got %q", zones.StarterMeadowZoneID, progress.CurrentZoneID)
	}
}

func TestMovePlayerUsesCurrentProgressWhenAlreadyMoving(t *testing.T) {
	hub := newGameHub()
	hub.world = buildTraversableTestWorld()
	baseTime := time.Date(2026, time.April, 21, 14, 0, 0, 0, time.UTC)
	currentTime := baseTime
	hub.now = func() time.Time {
		return currentTime
	}

	player := &playerState{
		ID:        "player:test",
		Username:  "test",
		X:         0.5,
		Y:         0.5,
		Speed:     2,
		UpdatedAt: currentTime,
	}
	hub.players[player.ID] = player

	if ok := hub.movePlayer(player.ID, "right"); !ok {
		t.Fatalf("expected first move command to succeed")
	}

	if player.TargetX == nil || math.Abs(*player.TargetX-1.5) > 0.001 {
		t.Fatalf("expected first move target to be 1.5, got %v", player.TargetX)
	}

	currentTime = baseTime.Add(250 * time.Millisecond)
	if ok := hub.movePlayer(player.ID, "right"); !ok {
		t.Fatalf("expected second move command to succeed")
	}

	if math.Abs(player.X-1.0) > 0.001 {
		t.Fatalf("expected player to advance to 1.0 before recalculating target, got %.3f", player.X)
	}

	if player.TargetX == nil || math.Abs(*player.TargetX-2.0) > 0.001 {
		t.Fatalf("expected recalculated target to stay one unit ahead at 2.0, got %v", player.TargetX)
	}
}

func TestWebSocketSessionUsesDistinctPlayerIDs(t *testing.T) {
	handler := NewHandler()
	testServer := httptest.NewServer(handler)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	firstConnection := openGameSocket(t, websocketURL, "rafa")
	defer firstConnection.Close()

	secondConnection := openGameSocket(t, websocketURL, "maya")
	defer secondConnection.Close()

	var firstSession sessionMessage
	if err := firstConnection.ReadJSON(&firstSession); err != nil {
		t.Fatalf("read first session: %v", err)
	}

	var firstInitialState worldStateMessage
	if err := firstConnection.ReadJSON(&firstInitialState); err != nil {
		t.Fatalf("read first initial state: %v", err)
	}

	var firstUpdatedState worldStateMessage
	if err := firstConnection.ReadJSON(&firstUpdatedState); err != nil {
		t.Fatalf("read first updated state: %v", err)
	}

	var secondSession sessionMessage
	if err := secondConnection.ReadJSON(&secondSession); err != nil {
		t.Fatalf("read second session: %v", err)
	}

	var secondInitialState worldStateMessage
	if err := secondConnection.ReadJSON(&secondInitialState); err != nil {
		t.Fatalf("read second initial state: %v", err)
	}

	if firstSession.PlayerID == secondSession.PlayerID {
		t.Fatalf("expected distinct player ids, got %q and %q", firstSession.PlayerID, secondSession.PlayerID)
	}

	if firstSession.Username != "rafa" || secondSession.Username != "maya" {
		t.Fatalf("expected usernames rafa and maya, got %q and %q", firstSession.Username, secondSession.Username)
	}

	if len(firstUpdatedState.Players) != 2 {
		t.Fatalf("expected first connection updated state to contain 2 players, got %d", len(firstUpdatedState.Players))
	}

	if len(secondInitialState.Players) != 2 {
		t.Fatalf("expected second connection initial state to contain 2 players, got %d", len(secondInitialState.Players))
	}

	if firstInitialState.Players[0].ID != firstSession.PlayerID {
		t.Fatalf("expected first player's initial snapshot to match first session id")
	}
}

func TestWebSocketReconnectLoadsPlayerStateByUsername(t *testing.T) {
	hub := newGameHub()
	hub.world = buildTraversableTestWorld()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", hub.handleWebSocket)
	handler := mux
	testServer := httptest.NewServer(handler)
	defer testServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws"
	firstConnection := openGameSocket(t, websocketURL, "beekeeper")

	var firstSession sessionMessage
	if err := firstConnection.ReadJSON(&firstSession); err != nil {
		t.Fatalf("read first session: %v", err)
	}

	var firstInitialState worldStateMessage
	if err := firstConnection.ReadJSON(&firstInitialState); err != nil {
		t.Fatalf("read first initial state: %v", err)
	}

	if err := firstConnection.WriteJSON(playerAction{Type: "move", Dir: "right"}); err != nil {
		t.Fatalf("send move right: %v", err)
	}

	var movedState worldStateMessage
	if err := firstConnection.ReadJSON(&movedState); err != nil {
		t.Fatalf("read moved state: %v", err)
	}

	expectedSpawnX, expectedSpawnY := profileSpawnPosition("beekeeper")
	expectedSpawnX, expectedSpawnY = hub.clampWorldPosition(expectedSpawnX, expectedSpawnY)
	expectedTargetX := clampToWorld(expectedSpawnX + 1)

	if math.Abs(movedState.Players[0].X-expectedSpawnX) > 0.001 || math.Abs(movedState.Players[0].Y-expectedSpawnY) > 0.001 {
		t.Fatalf("expected moved snapshot to preserve current position %.1f,%.1f, got %.1f,%.1f", expectedSpawnX, expectedSpawnY, movedState.Players[0].X, movedState.Players[0].Y)
	}

	if movedState.Players[0].TargetX == nil || math.Abs(*movedState.Players[0].TargetX-expectedTargetX) > 0.001 {
		t.Fatalf("expected moved snapshot target %.1f, got %v", expectedTargetX, movedState.Players[0].TargetX)
	}

	if err := firstConnection.Close(); err != nil {
		t.Fatalf("close first connection: %v", err)
	}

	secondConnection := openGameSocket(t, websocketURL, "beekeeper")
	defer secondConnection.Close()

	var secondSession sessionMessage
	if err := secondConnection.ReadJSON(&secondSession); err != nil {
		t.Fatalf("read second session: %v", err)
	}

	var restoredState worldStateMessage
	if err := secondConnection.ReadJSON(&restoredState); err != nil {
		t.Fatalf("read restored state: %v", err)
	}

	if secondSession.PlayerID != firstSession.PlayerID {
		t.Fatalf("expected same player id after reconnect, got %q and %q", firstSession.PlayerID, secondSession.PlayerID)
	}

	if secondSession.Username != "beekeeper" {
		t.Fatalf("expected restored username beekeeper, got %q", secondSession.Username)
	}

	if len(restoredState.Players) != 1 {
		t.Fatalf("expected one active player after reconnect, got %d", len(restoredState.Players))
	}

	restoredPlayer := restoredState.Players[0]
	if math.Abs(restoredPlayer.Y-expectedSpawnY) > 0.001 {
		t.Fatalf("expected restored Y %.1f, got %.1f", expectedSpawnY, restoredPlayer.Y)
	}

	if restoredPlayer.X < expectedSpawnX-0.001 || restoredPlayer.X > expectedTargetX+0.001 {
		t.Fatalf("expected restored X between %.1f and %.1f, got %.3f", expectedSpawnX, expectedTargetX, restoredPlayer.X)
	}

	if math.Abs(restoredPlayer.X-expectedTargetX) > 0.001 {
		if restoredPlayer.TargetX == nil || math.Abs(*restoredPlayer.TargetX-expectedTargetX) > 0.001 {
			t.Fatalf("expected in-flight restored target %.1f, got %v", expectedTargetX, restoredPlayer.TargetX)
		}
	}

	if restoredPlayer.Username != "beekeeper" {
		t.Fatalf("expected restored username beekeeper, got %q", restoredPlayer.Username)
	}
}
