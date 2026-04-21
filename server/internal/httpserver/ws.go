package httpserver

import (
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const maxUsernameLength = 24
const defaultPlayerSpeed = 3.0
const movementStopDistance = 0.08
const worldChunkSize = 4.0
const worldRenderDistance = 5
const worldTickInterval = 120 * time.Millisecond
const worldDecorationPadding = 0.55
const heartbeatInterval = 2 * time.Second
const clientInactivityTimeout = 7 * time.Second
const websocketWriteTimeout = time.Second

var errInvalidUsername = errors.New("username invalido")

type clientSession struct {
	id         string
	profileKey string
	conn       *websocket.Conn
	lastSeenAt time.Time
	writeMu    sync.Mutex
}

type gameHub struct {
	mu       sync.Mutex
	upgrader websocket.Upgrader
	clients  map[string]*clientSession
	players  map[string]*playerState
	profiles map[string]*playerState
	world    worldLayout
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
		world:    loadWorldLayout(),
		now:      time.Now,
	}

	go hub.runMovementLoop(worldTickInterval)
	go hub.runHeartbeatLoop(heartbeatInterval)

	return hub
}

func (hub *gameHub) snapshotMetrics() metricsResponse {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	return metricsResponse{
		Status:        "ok",
		Service:       "cara-de-abelha-server",
		Timestamp:     hub.now().UTC().Format(time.RFC3339),
		ActivePlayers: len(hub.players),
		Tick:          hub.tick,
	}
}

func (hub *gameHub) collectClients() []*clientSession {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	clients := make([]*clientSession, 0, len(hub.clients))
	for _, client := range hub.clients {
		clients = append(clients, client)
	}

	return clients
}

func (hub *gameHub) sendHeartbeats() {
	clients := hub.collectClients()
	if len(clients) == 0 {
		return
	}

	heartbeat := heartbeatMessage{
		Type:      "heartbeat",
		Timestamp: hub.now().UTC().Format(time.RFC3339),
	}

	for _, client := range clients {
		if err := hub.writeJSON(client, heartbeat); err != nil {
			log.Printf("websocket heartbeat failed for %s: %v", client.id, err)
		}
	}
}

func (hub *gameHub) pruneInactiveClients() []*clientSession {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	if len(hub.clients) == 0 {
		return nil
	}

	now := hub.now()
	staleClients := make([]*clientSession, 0)
	for clientID, client := range hub.clients {
		if client == nil {
			continue
		}

		if !client.lastSeenAt.IsZero() && now.Sub(client.lastSeenAt) <= clientInactivityTimeout {
			continue
		}

		staleClients = append(staleClients, client)
		delete(hub.clients, clientID)
		delete(hub.players, clientID)
		hub.tick++
	}

	return staleClients
}

func (hub *gameHub) runHeartbeatLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		staleClients := hub.pruneInactiveClients()
		for _, client := range staleClients {
			_ = client.conn.Close()
		}

		hub.sendHeartbeats()

		if len(staleClients) > 0 {
			hub.broadcast()
		}
	}
}
