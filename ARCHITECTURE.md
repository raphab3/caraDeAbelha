# Arquitetura - Cara de Abelha

## 📐 Visão Geral

O projeto segue uma arquitetura **server-authoritative** onde:
- **Backend (Go)**: Holds truth, validates all actions, manages game state
- **Frontend (React/Three.js)**: Renders state, sends player intentions
- **WebSocket**: Real-time bidirectional communication

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Browser)                      │
│  React + Three.js + TypeScript                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ GameViewport (3D Rendering)                              │ │
│  │ ├─ FlowerRenderer (instanced)                            │ │
│  │ ├─ HiveRenderer (instanced)                              │ │
│  │ ├─ ZoneGateRenderer (visual gates)                       │ │
│  │ ├─ RemoteBeesInstanced (other players)                   │ │
│  │ └─ BeeActor (local player)                               │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ GameHUD (UI Overlay)                                     │ │
│  │ ├─ ResourceRibbon (pollen/honey/XP display)              │ │
│  │ ├─ ObjectivePanel (current goals)                        │ │
│  │ ├─ InteractionFeed (action feedback)                     │ │
│  │ └─ ZoneUnlockPanel (zone info)                           │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useGameSession (State Hook)                              │ │
│  │ ├─ players: WorldPlayerState[]                           │ │
│  │ ├─ chunks: WorldChunkState[]                             │ │
│  │ ├─ connectionState: "idle" | "connecting" | ...          │ │
│  │ ├─ sendAction(action: ClientMessage)                     │ │
│  │ └─ moveToTarget, respawn, etc                            │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────────┘
                     │ WebSocket
                     │ camelCase JSON
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Go)                             │
│  HTTP Server + WebSocket + Game Loop                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ HTTP Server (port 8080)                                 │ │
│  │ ├─ GET /healthz (health check)                          │ │
│  │ ├─ GET /ws (upgrade to WebSocket)                       │ │
│  │ └─ GET /admin/* (admin endpoints)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ GameHub (Central Coordinator)                            │ │
│  │ ├─ mu (Mutex for thread safety)                          │ │
│  │ ├─ clients: map[string]*clientSession                   │ │
│  │ ├─ players: map[string]*playerState                     │ │
│  │ ├─ profiles: map[string]*playerState                    │ │
│  │ ├─ playerProgress: map[string]*PlayerProgress           │ │
│  │ ├─ loopbase: *LoopBaseService                           │ │
│  │ ├─ zones: *ZoneService                                  │ │
│  │ ├─ world: worldLayout                                   │ │
│  │ ├─ now(): time.Time (clock)                             │ │
│  │ └─ tick: uint64 (game loop counter)                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Services Layer                                           │ │
│  │ ├─ LoopBaseService (Collection & Deposit)               │ │
│  │ │  ├─ CollectFlowerPollen(progress, flower, x, y)       │ │
│  │ │  ├─ DepositPollenToHoney(progress, hive)              │ │
│  │ │  └─ GetFlowersByZone(zoneID) []*FlowerNode            │ │
│  │ ├─ ZoneService (Zone Unlock & Access)                   │ │
│  │ │  ├─ UnlockZone(progress, zoneID, time)                │ │
│  │ │  ├─ CanAccessZone(progress, zoneID)                   │ │
│  │ │  └─ GetZoneState(zoneID) *ZoneState                   │ │
│  │ └─ World Services (Movement & Rendering)                │ │
│  │    ├─ movePlayer(clientID, direction)                   │ │
│  │    ├─ movePlayerTo(clientID, x, z)                      │ │
│  │    └─ respawnPlayer(clientID)                           │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Game Loop (Goroutine)                                    │ │
│  │ ├─ Runs every ~16ms (60 FPS)                            │ │
│  │ ├─ Advances player positions                             │ │
│  │ ├─ Checks view distances                                 │ │
│  │ ├─ Broadcasts state changes                              │ │
│  │ └─ Sends player_status messages                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ World Layout (Map)                                       │ │
│  │ ├─ Chunks: [16x16 units each]                           │ │
│  │ ├─ Flowers: 500+ per zone                               │ │
│  │ ├─ Hives: 50+ per zone                                  │ │
│  │ ├─ Zones: 5 linear progression (zone_0 → zone_4)        │ │
│  │ └─ Boundaries: Impassable walls between zones            │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### Player Movement (Low Frequency)

```
1. Player presses arrow key
2. Frontend sends: { type: "move", dir: "up" }
3. Backend receives in WebSocket handler
4. GameHub.movePlayer() updates playerState
5. Movement loop advances position
6. Broadcasting on next tick: { type: "state", players: [...] }
7. Frontend receives new position
8. Three.js re-renders player
```

### Collection Action (Transactional)

```
1. Player clicks on flower (client-side raycast)
2. Frontend sends: { type: "collect_flower", nodeId: "flower_123" }
3. Backend receives action
4. GameHub.collectFlower(clientID, nodeId) executes:
   ├─ Lock mutex (critical section)
   ├─ Get player progress
   ├─ Check pollen capacity
   ├─ Add pollen
   ├─ Unlock mutex
   └─ Send feedback message
5. Frontend receives: { type: "interaction_result", success: true, value: 10 }
6. Frontend plays animation + sound
7. HUD updates to show new pollen count
```

### Zone Unlock (Complex Transaction)

```
1. Player clicks "Unlock zone_1" button
2. Frontend sends: { type: "unlock_zone", zoneId: "zone_1" }
3. Backend GameHub.unlockZone(clientID, "zone_1") executes:
   ├─ Lock mutex
   ├─ Get player progress
   ├─ Check if zone_0 is unlocked (prerequisite)
   ├─ Check honey balance (>= 5)
   ├─ Deduct honey from progress
   ├─ Add zone_1 to unlockedZoneIds
   ├─ Unlock mutex
   ├─ Send interaction_result (success, cost)
   ├─ Send updated player_status
   ├─ Send updated zone_state
   └─ Notify all players if in same area
4. Frontend receives updates
5. HUD refreshes zone list
6. Visual gates disappear from zone_1
```

## 🗂️ File Structure

### Backend

```
server/
├── main.go (entry point)
├── internal/
│   ├── httpserver/
│   │   ├── server.go (HTTP server setup)
│   │   ├── ws.go (WebSocket hub)
│   │   ├── ws_connection.go (message routing)
│   │   ├── ws_player.go (action handlers)
│   │   ├── ws_messages.go (protocol definitions)
│   │   ├── ws_messages_test.go
│   │   ├── ws_world.go (world layout)
│   │   ├── world_map.go
│   │   ├── world_map_zones_test.go
│   │   ├── admin_players.go (debug endpoints)
│   │   └── server_test.go
│   └── gameplay/
│       ├── loopbase/
│       │   ├── models.go (PlayerProgress, FlowerNode, HiveNode)
│       │   ├── models_test.go
│       │   ├── service.go (CollectFlowerPollen, DepositPollenToHoney)
│       │   └── service_test.go (12+ unit tests)
│       └── zones/
│           ├── models.go (ZoneState definitions)
│           ├── models_test.go
│           ├── service.go (UnlockZone, CanAccessZone)
│           └── service_test.go (15+ unit tests)
├── maps/
│   └── map.json (zone definitions, transitions, boundaries)
└── go.mod / go.sum
```

### Frontend

```
client/
├── src/
│   ├── main.tsx (app entry)
│   ├── App.tsx (router setup)
│   ├── types/
│   │   └── game.ts (protocol types)
│   ├── hooks/
│   │   └── useGameSession.ts (WebSocket + state management)
│   ├── components/
│   │   ├── GameViewport/
│   │   │   ├── index.tsx (main canvas + HUD composition)
│   │   │   ├── InstancedWorldField.tsx (entities + terrain)
│   │   │   ├── FlowerRenderer.tsx (InstancedMesh)
│   │   │   ├── HiveRenderer.tsx (InstancedMesh)
│   │   │   ├── ZoneGateRenderer.tsx (visual gates)
│   │   │   ├── RemoteBeesInstanced.tsx
│   │   │   ├── BeeActor.tsx (local player)
│   │   │   ├── AtmosphereBackdrop.tsx
│   │   │   ├── MiniMap.tsx
│   │   │   ├── CameraRig.tsx
│   │   │   ├── RendererMetricsReporter.tsx
│   │   │   ├── worldSurface.ts (terrain utilities)
│   │   │   └── useTapTargeting.ts (click detection)
│   │   └── PlayerExperience/
│   │       └── index.tsx (composition + session management)
│   ├── game/
│   │   ├── hud/
│   │   │   ├── GameHUD.tsx (composition)
│   │   │   ├── ResourceRibbon.tsx (stats display)
│   │   │   ├── ObjectivePanel.tsx (goals)
│   │   │   ├── InteractionFeed.tsx (action feedback)
│   │   │   └── ZoneUnlockPanel.tsx (zone info)
│   │   ├── env.ts (configuration)
│   │   └── WSClient.ts (WebSocket wrapper)
│   ├── pages/
│   │   ├── index.tsx (home)
│   │   ├── game.tsx (main gameplay)
│   │   └── not-found.tsx (404)
│   ├── styles/
│   │   └── globals.css
│   └── shared/
│       ├── components/ (reusable UI)
│       ├── hooks/ (reusable logic)
│       ├── types/ (shared types)
│       └── utils/ (helpers)
├── vite.config.ts
├── tsconfig.json
├── package.json
└── pnpm-lock.yaml
```

## 🔐 Security Model

### Server-Authoritative Pattern

**Principle**: Never trust client claims about game state.

```go
// ✅ CORRECT: Server validates
func (hub *gameHub) unlockZone(clientID string, zoneID string) bool {
    progress := hub.playerProgress[clientID]
    
    // Check honey on SERVER
    if progress.Honey < zone.Cost {
        return false
    }
    
    // Check prerequisites on SERVER
    if !hub.zones.CanAccessZone(progress, zoneID) {
        return false
    }
    
    // Apply change on SERVER
    progress.Honey -= zone.Cost
    progress.UnlockedZoneIDs = append(progress.UnlockedZoneIDs, zoneID)
}

// ❌ WRONG: Trusting client
if (clientData.honey >= 5) {
    // Client could fake this!
    this.unlockedZones.add("zone_1");
}
```

### Action Validation

1. **Authentication**: WebSocket connection authenticated via profileKey
2. **Authorization**: Check if player can perform action
3. **Input Validation**: Check bounds and types
4. **Business Rules**: Check game logic (honey, prerequisites, etc)
5. **State Consistency**: Use mutex for atomic updates

### Exploit Prevention

- **Pollen Capacity**: Prevents unlimited farming
- **Honey Cost**: Progressive unlock costs create natural progression
- **Prerequisite Chain**: Enforces linear zone progression
- **Server Validation**: No client-side exploits possible

## 📊 State Management

### Backend State (Mutable, Authoritative)

```go
type playerState struct {
    ID          string
    Username    string
    X, Y        float64      // Position
    TargetX, TargetY float64 // Movement target
    Speed       float64
    Moving      bool
    Direction   string
    UpdatedAt   time.Time
    LastSeenAt  time.Time
}

type PlayerProgress struct {
    PlayerID        string
    PollenCarried   int
    PollenCapacity  int
    Honey           int
    Level           int
    XP              int
    CurrentZoneID   string
    UnlockedZoneIDs []string
    UpdatedAt       time.Time
}
```

### Frontend State (Derived, Cached)

```typescript
interface GameSessionState {
    connectionState: "idle" | "connecting" | "connected" | "disconnected";
    localUsername?: string;
    localPlayerId?: string;
    players: WorldPlayerState[];
    chunks: WorldChunkState[];
    centerChunkX: number;
    centerChunkY: number;
    renderDistance: number;
    chunkSize: number;
    tick: uint64;
    zoneState?: ZoneStateMessage;
    playerProgress?: PlayerProgressState;
    error?: string;
}
```

## 🎮 Game Loop

### Backend Loop (60 FPS)

```
Every 16.67ms:
1. Lock players mutex
2. For each player:
   ├─ Calculate new position (if moving)
   ├─ Check boundaries
   ├─ Update UpdatedAt timestamp
   └─ Mark for broadcast if moved
3. Unlock mutex
4. For each client:
   ├─ Calculate visible chunks
   ├─ Send state message
   └─ Send performance updates
5. Increment tick counter
6. Sleep remainder of frame
```

### Frontend Loop (60 FPS)

```
Every frame:
1. Receive WebSocket messages (async)
2. Update game state from messages
3. Three.js render:
   ├─ Update cameras
   ├─ Update player positions
   ├─ Update remote players
   ├─ Render all entities
   └─ Render HUD
4. Handle input events
5. Queue WebSocket sends
```

## 🚀 Optimization Strategies

### Networking

- **Message Batching**: Multiple updates in one message
- **Delta Compression**: Only send changed fields
- **Selective Sync**: Only send visible entities
- **Message Throttling**: 50 msgs/sec max per player

### Rendering

- **Instancing**: FlowerRenderer uses InstancedMesh (500+ flowers, 1 draw call)
- **Culling**: Off-screen entities not rendered
- **LOD**: Far entities render at lower quality
- **Spatial Partitioning**: Chunking system for visibility

### Backend

- **Goroutines**: Separate goroutine per WebSocket connection
- **Mutex Locking**: Only locked for critical sections
- **Memory Pooling**: Reuse message buffers
- **Cache**: Static zone data cached in memory

## 📝 Protocol Design

### Message Format

All messages follow this pattern:

```json
{
  "type": "message_type",
  "field1": "value1",
  "field2": 123
}
```

**Constraints:**
- Field names: camelCase (not snake_case)
- Message types: snake_case
- Numbers: JSON numbers (not strings)
- Booleans: JSON booleans (true/false, not "true")

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| state | S→C | Full world state (50 msgs/sec) |
| player_status | S→C | Player economy state |
| interaction_result | S→C | Feedback for player actions |
| zone_state | S→C | Zone unlock info |
| move | C→S | Player movement direction |
| move_to | C→S | Move to target position |
| collect_flower | C→S | Request pollen collection |
| deposit_honey | C→S | Request honey deposit |
| unlock_zone | C→S | Request zone unlock |
| respawn | C→S | Request respawn |

## 🔧 Configuration

### Environment Variables

```bash
# Backend
LISTEN_PORT=8080           # HTTP server port
WS_ADDR=localhost:8080     # WebSocket endpoint

# Frontend
VITE_SERVER_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080

# Networking
TICK_RATE=60               # Server FPS
MESSAGE_RATE=50            # msgs/sec per player
CHUNK_SIZE=16              # World units
RENDER_DISTANCE=3          # Chunks visible
```

### Game Balance

```go
const (
    PollenPerFlower    = 10
    PollenToHoneyRatio = 10 // 10 pollen = 1 honey
    MaxPollenCapacity  = 100
    
    Zone1Honey  = 5
    Zone2Honey  = 10
    Zone3Honey  = 15
    Zone4Honey  = 20
)
```

---

**Next Update**: After Epic 3 implementation
