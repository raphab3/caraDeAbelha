package httpserver

import (
	"errors"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
)

const maxUsernameLength = 24
const defaultPlayerSpeed = 3.0
const movementStopDistance = 0.08
const worldChunkSize = 4.0
const worldRenderDistance = 5
const worldTickInterval = 120 * time.Millisecond
const worldDecorationPadding = 0.55
const websocketWriteTimeout = 2 * time.Second
const websocketPongWait = 15 * time.Second
const websocketPingPeriod = (websocketPongWait * 9) / 10

var errInvalidUsername = errors.New("username invalido")

type clientSession struct {
	id         string
	profileKey string
	conn       *websocket.Conn
	writeMu    sync.Mutex
}

type gameHub struct {
	mu                sync.Mutex
	upgrader          websocket.Upgrader
	clients           map[string]*clientSession
	players           map[string]*playerState
	profiles          map[string]*playerState
	playerProgress    map[string]*loopbase.PlayerProgress // Player economy state: pollen, honey, level, zones
	playerStore       playerStore
	stageStore        stageStore
	stageRegistry     *stageRegistry
	stageRuntimes     map[string]*stageRuntime
	world             worldLayout
	loopbase          *loopbase.LoopBaseService
	zones             *zones.ZoneService
	flowerSpawnSlots  map[string]flowerSpawnSlot
	activeFlowers     map[string]*activeFlowerRuntime
	activeHives       map[string]*activeHiveRuntime
	activeCollections map[string]*collectionState
	random            *rand.Rand
	tick              uint64
	now               func() time.Time
	pingPeriod        time.Duration
	pongWait          time.Duration
	writeWait         time.Duration
}

func newGameHub() *gameHub {
	loopbaseService := loopbase.NewLoopBaseService()
	zonesService := zones.NewZoneService()
	stageStore := newStageStoreFromEnv()
	stageRegistry := newStageRegistry(stageStore)

	// Connect zones service to loopbase for zone access validation
	loopbaseService.SetZoneChecker(zonesService)

	hub := &gameHub{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool {
				return true
			},
		},
		clients:        make(map[string]*clientSession),
		players:        make(map[string]*playerState),
		profiles:       make(map[string]*playerState),
		playerProgress: make(map[string]*loopbase.PlayerProgress),
		playerStore:    newPlayerStoreFromEnv(),
		stageStore:     stageStore,
		stageRegistry:  stageRegistry,
		world:          stageRegistry.loadInitialLayout(),
		loopbase:       loopbaseService,
		zones:          zonesService,
		random:         rand.New(rand.NewSource(time.Now().UnixNano())),
		now:            time.Now,
		pingPeriod:     websocketPingPeriod,
		pongWait:       websocketPongWait,
		writeWait:      websocketWriteTimeout,
	}

	hub.initializeWorldEntities()
	go hub.runMovementLoop(worldTickInterval)
	go hub.runPersistenceLoop(persistenceSaveInterval)

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
