# Loop Base Module

The `loopbase` module implements the core economic models and gameplay service for the Cara de Abelha MMORPG foundation epic: "Loop Base - Coleta e Mel".

## Components

### Models (`models.go`)

#### PlayerProgress

Tracks the player's economy state:
- **PollenCarried**: Current pollen in backpack
- **PollenCapacity**: Maximum pollen the backpack can hold
- **Honey**: Accumulated honey (permanent currency)
- **Level**: Player level (for future progression)
- **XP**: Experience points (for future progression)
- **SkillPoints**: Unspent skill points (for future progression)
- **CurrentZoneID**: Zone the player currently occupies
- **UnlockedZoneIDs**: Zones the player has access to

This model is **server-authoritative** and sent to the client via `player_status` messages.

#### FlowerNode

Represents a world flower that players can collect pollen from:
- **PollenAvailable**: Current pollen amount in this flower
- **PollenCapacity**: Maximum pollen this flower can store
- **CollectRadius**: Distance at which a player can interact with this flower
- **RegenPerSecond**: Rate at which pollen regenerates
- **YieldPerClick**: Pollen granted per successful collection
- **LastRegenAt**: Timestamp of last regeneration tick (for server-side regen logic)

#### HiveNode

Represents a collection point (beehive) where players convert pollen to honey:
- **DepositRadius**: Distance at which a player triggers automatic deposit
- **ConversionRate**: Pollen-to-honey ratio (e.g., 10 pollen = 1 honey)

When a player enters the `DepositRadius` of a hive carrying pollen, the server automatically converts their pollen to honey and clears their backpack.

### Service (`service.go`)

The `LoopBaseService` manages the lifecycle of gameplay entities (FlowerNode and HiveNode) during a session.

#### Public API

```go
// Constructor - initializes service with zone:start test data
func NewLoopBaseService() *LoopBaseService

// Retrieve entities by zone
func (s *LoopBaseService) GetFlowersByZone(zoneID string) []*FlowerNode
func (s *LoopBaseService) GetHivesByZone(zoneID string) []*HiveNode

// Validate player position relative to entity interaction radius
func (s *LoopBaseService) IsPlayerInFlowerRange(playerX, playerY float64, flower *FlowerNode) bool
func (s *LoopBaseService) IsPlayerInHiveRange(playerX, playerY float64, hive *HiveNode) bool

// Dynamic entity management (for testing and future features)
func (s *LoopBaseService) AddFlowerToZone(zoneID string, flower *FlowerNode) error
func (s *LoopBaseService) AddHiveToZone(zoneID string, hive *HiveNode) error
```

#### Features

- **Thread-safe**: Uses `sync.RWMutex` for concurrent read access
- **Zone-based organization**: Entities indexed by zone ID for multi-zone support
- **Distance validation**: Euclidean distance calculation with boundary testing
- **Error handling**: Validates nil entities and empty zone IDs

#### Initial Test Data (zone:start)

```
zone:start:
├── Flower[0]: "flower:start:1" at (5.0, 5.0)
│   ├── CollectRadius: 2.5
│   ├── Pollen: 100/100
│   └── YieldPerClick: 5
├── Flower[1]: "flower:start:2" at (10.0, 8.0)
│   ├── CollectRadius: 2.5
│   ├── Pollen: 100/100
│   └── YieldPerClick: 5
└── Hive[0]: "hive:start" at (0.0, 0.0)
    ├── DepositRadius: 3.0
    └── ConversionRate: 10
```

## Testing

The module includes comprehensive test coverage (`service_test.go`) with 35 tests:

- Service initialization and default data validation
- Zone-based entity retrieval and isolation
- Distance validation (boundary cases, diagonals, edge cases)
- Error handling (nil entities, invalid zones)
- Dynamic entity addition
- Thread-safety verification
- Concurrent access patterns

Run tests with:
```bash
go test ./internal/gameplay/loopbase/...
```

## Integration

The service is automatically instantiated in the WebSocket game hub:

```go
// In server/internal/httpserver/ws.go
type gameHub struct {
    // ...
    loopbase *loopbase.LoopBaseService
    // ...
}

// Usage in hub methods
flowers := hub.loopbase.GetFlowersByZone("zone:start")
isInRange := hub.loopbase.IsPlayerInFlowerRange(playerX, playerY, flower)
```

## Architectural Notes

1. **Server-Authoritative**: All calculations for pollen collection, capacity validation, and distance checking happen on the server. The client sends intentions; the server validates and applies state changes.

2. **Minimal State for MVP**: The service contains only what's needed for the core loop. Future systems (RPG, PvE, quests, helpers, world events) will extend these with additional functionality.

3. **Zone Support**: Both flowers and hives are zone-aware (via `ZoneID`), preparing for zone unlock and blocking mechanics in future tasks.

4. **Distance Validation**: Uses Euclidean distance: `sqrt((x2-x1)² + (y2-y1)²)` with boundary testing (`distance <= radius`).

5. **No Rendering Changes**: The visual state snapshot system (`world_map.go`, `ws_world.go`) continues unchanged. Backend entities run in parallel.

## Next Steps

The service provides the foundation for:

- Collection action validation (check player in flower range)
- Pollen depletion mechanics on collection
- Hive deposit and automatic conversion
- Zone-based content blocking
- Procedural entity generation per zone
- Entity persistence across sessions
- Multi-player interaction validation

## Protocol Integration

These models and service map to WebSocket messages and game actions:
- `PlayerProgress` ↔ `player_status` message (sent to player only)
- `FlowerNode` ↔ visual props in `state` + validation logic in `collect_flower` action
- `HiveNode` ↔ visual props in `state` + validation logic in deposit proximity check

See `design.md` in the feature spec for protocol details.

