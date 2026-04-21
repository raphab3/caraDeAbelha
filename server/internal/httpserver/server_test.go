package httpserver

import (
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

	if initialState.Players[0].X != 0 || initialState.Players[0].Y != 0 {
		t.Fatalf("expected initial position 0,0, got %d,%d", initialState.Players[0].X, initialState.Players[0].Y)
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

	if updatedState.Players[0].X != 1 || updatedState.Players[0].Y != 0 {
		t.Fatalf("expected updated position 1,0, got %d,%d", updatedState.Players[0].X, updatedState.Players[0].Y)
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

	if restoredState.Players[0].X != 1 || restoredState.Players[0].Y != 0 {
		t.Fatalf("expected restored position 1,0, got %d,%d", restoredState.Players[0].X, restoredState.Players[0].Y)
	}

	if restoredState.Players[0].Username != "beekeeper" {
		t.Fatalf("expected restored username beekeeper, got %q", restoredState.Players[0].Username)
	}
}
