package httpserver

import (
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
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
	baseTime := time.Date(2026, time.April, 21, 12, 0, 0, 0, time.UTC)
	targetX := 3.0
	targetY := 0.0
	player := &playerState{
		ID:        "player:test",
		Username:  "test",
		X:         0,
		Y:         0,
		TargetX:   &targetX,
		TargetY:   &targetY,
		Speed:     2,
		UpdatedAt: baseTime,
	}

	hub.advancePlayerLocked(player, baseTime.Add(500*time.Millisecond))

	if math.Abs(player.X-1.0) > 0.001 || math.Abs(player.Y) > 0.001 {
		t.Fatalf("expected player to advance to 1.0,0.0 after 0.5s, got %.3f,%.3f", player.X, player.Y)
	}

	if player.TargetX == nil || player.TargetY == nil {
		t.Fatalf("expected player target to remain active mid-journey")
	}

	hub.advancePlayerLocked(player, baseTime.Add(1500*time.Millisecond))

	if math.Abs(player.X-3.0) > 0.001 || math.Abs(player.Y) > 0.001 {
		t.Fatalf("expected player to reach 3.0,0.0 after 1.5s, got %.3f,%.3f", player.X, player.Y)
	}

	if player.TargetX != nil || player.TargetY != nil {
		t.Fatalf("expected player target to clear on arrival")
	}
}

func TestMovePlayerUsesCurrentProgressWhenAlreadyMoving(t *testing.T) {
	hub := newGameHub()
	baseTime := time.Date(2026, time.April, 21, 14, 0, 0, 0, time.UTC)
	currentTime := baseTime
	hub.now = func() time.Time {
		return currentTime
	}

	player := &playerState{
		ID:        "player:test",
		Username:  "test",
		X:         0,
		Y:         0,
		Speed:     2,
		UpdatedAt: currentTime,
	}
	hub.players[player.ID] = player

	if ok := hub.movePlayer(player.ID, "right"); !ok {
		t.Fatalf("expected first move command to succeed")
	}

	if player.TargetX == nil || math.Abs(*player.TargetX-1) > 0.001 {
		t.Fatalf("expected first move target to be 1.0, got %v", player.TargetX)
	}

	currentTime = baseTime.Add(250 * time.Millisecond)
	if ok := hub.movePlayer(player.ID, "right"); !ok {
		t.Fatalf("expected second move command to succeed")
	}

	if math.Abs(player.X-0.5) > 0.001 {
		t.Fatalf("expected player to advance to 0.5 before recalculating target, got %.3f", player.X)
	}

	if player.TargetX == nil || math.Abs(*player.TargetX-1.5) > 0.001 {
		t.Fatalf("expected recalculated target to stay one unit ahead at 1.5, got %v", player.TargetX)
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
	handler := NewHandler()
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
