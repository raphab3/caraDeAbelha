package httpserver

import (
	"errors"
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

var errInvalidUsername = errors.New("username invalido")

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
