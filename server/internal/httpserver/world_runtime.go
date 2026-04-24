package httpserver

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/progression"
)

const defaultFlowerCollectRadius = 0.65
const defaultHiveDepositRadius = 0.8
const defaultHoneyConversionRate = 10
const flowerRespawnMinSeconds = 15
const flowerRespawnMaxSeconds = 45
const collectorHiveID = "hive:collector"
const collectorHiveX = 0.5
const collectorHiveY = 0.5
const collectorHiveScale = 2.4
const collectorHiveDepositRadius = 1.75

type flowerSpawnSlot struct {
	ID       string
	ChunkKey string
	X        float64
	Y        float64
	GroundY  float64
	Scale    float64
	Level    int
	Petal    string
	Core     string
}

type activeFlowerRuntime struct {
	EntityID  string
	SlotID    string
	State     worldFlowerState
	Node      *loopbase.FlowerNode
	Level     int
	Available bool
	RespawnAt time.Time
}

type activeHiveRuntime struct {
	ChunkKey string
	State    worldHiveState
	Node     *loopbase.HiveNode
}

type collectionState struct {
	FlowerID   string
	StartedAt  time.Time
	CompleteAt time.Time
}

func (hub *gameHub) initializeWorldEntities() {
	if hub == nil {
		return
	}

	hub.flowerSpawnSlots = make(map[string]flowerSpawnSlot)
	hub.activeFlowers = make(map[string]*activeFlowerRuntime)
	hub.activeHives = make(map[string]*activeHiveRuntime)
	hub.activeCollections = make(map[string]*collectionState)

	if hub.random == nil {
		hub.random = rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	type visualSeed struct {
		ID         string
		X          float64
		Y          float64
		GroundY    float64
		Scale      float64
		PetalColor string
		CoreColor  string
	}

	initialFlowers := make([]visualSeed, 0)
	for chunkKey, chunk := range hub.world.chunks {
		blocked := make(map[string]struct{}, len(chunk.Trees)+len(chunk.Hives))
		for _, tree := range chunk.Trees {
			blocked[positionKey(tree.X, tree.Y)] = struct{}{}
		}
		for _, hive := range chunk.Hives {
			blocked[positionKey(hive.X, hive.Y)] = struct{}{}
			hub.activeHives[hive.ID] = &activeHiveRuntime{
				ChunkKey: chunkKey,
				State:    hive,
				Node: &loopbase.HiveNode{
					ID:             hive.ID,
					X:              hive.X,
					Y:              hive.Y,
					GroundY:        hive.GroundY,
					ZoneID:         hub.world.zoneIDAt(hive.X, hive.Y),
					DepositRadius:  defaultHiveDepositRadius,
					ConversionRate: defaultHoneyConversionRate,
				},
			}
		}

		for _, tile := range chunk.Tiles {
			if tile.Type != "grass" {
				continue
			}

			if _, isBlocked := blocked[positionKey(tile.X, tile.Z)]; isBlocked {
				continue
			}

			slotID := fmt.Sprintf("slot:%s:%d:%d", chunkKey, quantizeMapCoord(tile.X), quantizeMapCoord(tile.Z))
			level := resolveFlowerLevel(tile.X, tile.Z)
			hub.flowerSpawnSlots[slotID] = flowerSpawnSlot{
				ID:       slotID,
				ChunkKey: chunkKey,
				X:        tile.X,
				Y:        tile.Z,
				GroundY:  tile.Y,
				Scale:    hashRange(0.84, 1.18, quantizeMapCoord(tile.X), quantizeMapCoord(tile.Z), 301),
				Level:    level,
				Petal:    flowerPetalPalette[positiveModulo(int(hashUint32(quantizeMapCoord(tile.X), quantizeMapCoord(tile.Z), 41)), len(flowerPetalPalette))],
				Core:     flowerCorePalette[positiveModulo(int(hashUint32(quantizeMapCoord(tile.X), quantizeMapCoord(tile.Z), 53)), len(flowerCorePalette))],
			}
		}

		for _, flower := range chunk.Flowers {
			initialFlowers = append(initialFlowers, visualSeed{
				ID:         flower.ID,
				X:          flower.X,
				Y:          flower.Y,
				GroundY:    flower.GroundY,
				Scale:      flower.Scale,
				PetalColor: flower.PetalColor,
				CoreColor:  flower.CoreColor,
			})
		}
	}

	for _, seed := range initialFlowers {
		slot := hub.findBestSlotForFlower(seed.X, seed.Y)
		if slot == nil {
			continue
		}

		level := slot.Level
		yield := flowerYieldForLevel(level)
		hub.activeFlowers[seed.ID] = &activeFlowerRuntime{
			EntityID: seed.ID,
			SlotID:   slot.ID,
			State: worldFlowerState{
				ID:         seed.ID,
				X:          slot.X,
				Y:          slot.Y,
				GroundY:    slot.GroundY,
				Scale:      seed.Scale,
				PetalColor: seed.PetalColor,
				CoreColor:  seed.CoreColor,
			},
			Node: &loopbase.FlowerNode{
				ID:              seed.ID,
				X:               slot.X,
				Y:               slot.Y,
				GroundY:         slot.GroundY,
				ZoneID:          hub.world.zoneIDAt(slot.X, slot.Y),
				PollenAvailable: yield,
				PollenCapacity:  yield,
				CollectRadius:   defaultFlowerCollectRadius,
				YieldPerClick:   yield,
			},
			Level:     level,
			Available: true,
		}
	}

	hub.ensureCollectorHive()
	hub.syncDefaultStageRuntimeLocked()
}

func (hub *gameHub) syncDefaultStageRuntimeLocked() {
	if hub == nil {
		return
	}

	stageID := hub.world.stageID
	if stageID == "" {
		stageID = "stage:fallback"
	}

	versionID := ""
	if hub.stageRegistry != nil {
		versionID = hub.stageRegistry.activeVersionID()
	}

	hub.stageRuntimes = map[string]*stageRuntime{
		stageID: {
			stageID:     stageID,
			versionID:   versionID,
			layout:      hub.world,
			players:     hub.players,
			flowers:     hub.activeFlowers,
			hives:       hub.activeHives,
			collections: hub.activeCollections,
		},
	}
}

func (hub *gameHub) buildVisibleChunksLocked(centerChunkX int, centerChunkY int) []worldChunkState {
	baseChunks := hub.world.visibleChunksAround(centerChunkX, centerChunkY)
	visibleChunks := make([]worldChunkState, 0, len(baseChunks))
	chunkIndexes := make(map[string]int, len(baseChunks))

	for _, chunk := range baseChunks {
		clone := chunk
		clone.Flowers = []worldFlowerState{}
		clone.Hives = []worldHiveState{}
		chunkIndexes[clone.Key] = len(visibleChunks)
		visibleChunks = append(visibleChunks, clone)
	}

	for _, flower := range hub.activeFlowers {
		if flower == nil || !flower.Available {
			continue
		}

		chunkKey := buildChunkKey(worldAxisToChunk(flower.State.X), worldAxisToChunk(flower.State.Y))
		index, ok := chunkIndexes[chunkKey]
		if !ok {
			continue
		}

		visibleChunks[index].Flowers = append(visibleChunks[index].Flowers, flower.State)
	}

	for _, hive := range hub.activeHives {
		if hive == nil {
			continue
		}

		index, ok := chunkIndexes[hive.ChunkKey]
		if !ok {
			continue
		}

		visibleChunks[index].Hives = append(visibleChunks[index].Hives, hive.State)
	}

	for index := range visibleChunks {
		sort.Slice(visibleChunks[index].Flowers, func(left int, right int) bool {
			return visibleChunks[index].Flowers[left].ID < visibleChunks[index].Flowers[right].ID
		})
		sort.Slice(visibleChunks[index].Hives, func(left int, right int) bool {
			return visibleChunks[index].Hives[left].ID < visibleChunks[index].Hives[right].ID
		})
	}

	return visibleChunks
}

func (hub *gameHub) processWorldInteractionsLocked(now time.Time) bool {
	if hub == nil {
		return false
	}

	changed := hub.respawnFlowersLocked(now)
	for _, player := range hub.players {
		if player == nil {
			continue
		}

		progress := hub.ensurePlayerProgressLocked(player.ID)
		hub.updatePlayerZoneLocked(player, progress)
		if hub.processHiveDepositLocked(player, progress) {
			changed = true
		}
		if hub.processFlowerCollectionLocked(player, progress, now) {
			changed = true
		}
	}

	return changed
}

func (hub *gameHub) processHiveDepositLocked(player *playerState, progress *loopbase.PlayerProgress) bool {
	if player == nil || progress == nil || progress.PollenCarried < defaultHoneyConversionRate {
		return false
	}

	hive := hub.findHiveInRangeLocked(player.X, player.Y)
	if hive == nil {
		return false
	}

	honeyGained, err := hub.loopbase.DepositPollenToHoney(progress, hive.Node)
	if err != nil || honeyGained <= 0 {
		return false
	}

	client := hub.clients[player.ID]
	hub.sendInteractionResult(client, "deposit_honey", true, honeyGained, "Mel convertido na colmeia")
	if hub.addXPToProgressLocked(progress, honeyGained*4) {
		hub.sendInteractionResult(client, "level_up", true, progress.Level, fmt.Sprintf("Nivel %d alcancado", progress.Level))
	}
	hub.sendPlayerStatus(client, progress)
	return true
}

func (hub *gameHub) processFlowerCollectionLocked(player *playerState, progress *loopbase.PlayerProgress, now time.Time) bool {
	if player == nil || progress == nil {
		return false
	}

	currentCollection := hub.activeCollections[player.ID]
	if currentCollection != nil {
		flower := hub.activeFlowers[currentCollection.FlowerID]
		if flower == nil || !flower.Available || !hub.loopbase.IsPlayerInFlowerRange(player.X, player.Y, flower.Node) {
			delete(hub.activeCollections, player.ID)
			hub.sendInteractionResult(hub.clients[player.ID], "collect_flower", false, 0, "Coleta interrompida")
			return false
		}

		if now.Before(currentCollection.CompleteAt) {
			return false
		}

		delete(hub.activeCollections, player.ID)
		client := hub.clients[player.ID]
		pollenCollected := 0
		if progress.PollenCarried < progress.PollenCapacity {
			collected, err := hub.loopbase.CollectFlowerPollen(progress, flower.Node, player.X, player.Y)
			if err != nil || collected <= 0 {
				if err != nil {
					hub.sendInteractionResult(client, "collect_flower", false, 0, err.Error())
				}
				return false
			}
			pollenCollected = collected
		}

		hub.scheduleFlowerRespawnLocked(flower, now)
		reason := fmt.Sprintf("Flor nivel %d coletada", flower.Level)
		if pollenCollected == 0 {
			reason = fmt.Sprintf("Mochila cheia: flor nivel %d estudada, XP ganho", flower.Level)
		}
		hub.sendInteractionResult(client, "collect_flower", true, pollenCollected, reason)
		if hub.addXPToProgressLocked(progress, flowerXPForLevel(flower.Level)) {
			hub.sendInteractionResult(client, "level_up", true, progress.Level, fmt.Sprintf("Nivel %d alcancado", progress.Level))
		}
		hub.sendPlayerStatus(client, progress)
		return true
	}

	flower := hub.findFlowerInRangeLocked(player.X, player.Y)
	if flower == nil {
		return false
	}

	hub.activeCollections[player.ID] = &collectionState{
		FlowerID:   flower.EntityID,
		StartedAt:  now,
		CompleteAt: now.Add(flowerCollectDuration(flower.Level)),
	}
	hub.sendInteractionResult(hub.clients[player.ID], "collect_flower", true, 0, fmt.Sprintf("Coletando flor nivel %d...", flower.Level))
	return false
}

func (hub *gameHub) respawnFlowersLocked(now time.Time) bool {
	changed := false
	for _, flower := range hub.activeFlowers {
		if flower == nil || flower.Available || flower.RespawnAt.IsZero() || now.Before(flower.RespawnAt) {
			continue
		}

		slot := hub.pickRespawnSlotLocked(flower.EntityID)
		if slot == nil {
			continue
		}

		flower.SlotID = slot.ID
		flower.Level = slot.Level
		flower.Available = true
		flower.RespawnAt = time.Time{}
		flower.State.X = slot.X
		flower.State.Y = slot.Y
		flower.State.GroundY = slot.GroundY
		flower.State.Scale = slot.Scale
		flower.State.PetalColor = slot.Petal
		flower.State.CoreColor = slot.Core
		flower.Node.X = slot.X
		flower.Node.Y = slot.Y
		flower.Node.GroundY = slot.GroundY
		flower.Node.ZoneID = hub.world.zoneIDAt(slot.X, slot.Y)
		flower.Node.YieldPerClick = flowerYieldForLevel(slot.Level)
		flower.Node.PollenCapacity = flower.Node.YieldPerClick
		flower.Node.PollenAvailable = flower.Node.YieldPerClick
		changed = true
	}

	return changed
}

func (hub *gameHub) scheduleFlowerRespawnLocked(flower *activeFlowerRuntime, now time.Time) {
	if flower == nil {
		return
	}

	flower.Available = false
	flower.Node.PollenAvailable = 0
	flower.Node.UpdatedAt = now
	flower.RespawnAt = now.Add(time.Duration(hub.random.Intn(flowerRespawnMaxSeconds-flowerRespawnMinSeconds+1)+flowerRespawnMinSeconds) * time.Second)

	for playerID, collection := range hub.activeCollections {
		if collection != nil && collection.FlowerID == flower.EntityID {
			delete(hub.activeCollections, playerID)
		}
	}
}

func (hub *gameHub) pickRespawnSlotLocked(flowerID string) *flowerSpawnSlot {
	if len(hub.flowerSpawnSlots) == 0 {
		return nil
	}

	occupied := make(map[string]struct{}, len(hub.activeFlowers))
	for entityID, flower := range hub.activeFlowers {
		if entityID == flowerID || flower == nil || !flower.Available {
			continue
		}
		occupied[flower.SlotID] = struct{}{}
	}

	availableSlots := make([]flowerSpawnSlot, 0, len(hub.flowerSpawnSlots))
	for _, slot := range hub.flowerSpawnSlots {
		if _, isOccupied := occupied[slot.ID]; isOccupied {
			continue
		}
		availableSlots = append(availableSlots, slot)
	}

	if len(availableSlots) == 0 {
		return nil
	}

	slot := availableSlots[hub.random.Intn(len(availableSlots))]
	return &slot
}

func (hub *gameHub) findBestSlotForFlower(x float64, y float64) *flowerSpawnSlot {
	var (
		bestSlot     *flowerSpawnSlot
		bestDistance = math.Inf(1)
	)

	for _, slot := range hub.flowerSpawnSlots {
		distance := math.Hypot(slot.X-x, slot.Y-y)
		if distance >= bestDistance {
			continue
		}

		candidate := slot
		bestSlot = &candidate
		bestDistance = distance
	}

	return bestSlot
}

func (hub *gameHub) findFlowerInRangeLocked(x float64, y float64) *activeFlowerRuntime {
	var (
		bestFlower   *activeFlowerRuntime
		bestDistance = math.Inf(1)
	)

	for _, flower := range hub.activeFlowers {
		if flower == nil || !flower.Available || flower.Node == nil {
			continue
		}

		distance := math.Hypot(flower.Node.X-x, flower.Node.Y-y)
		if distance > flower.Node.CollectRadius || distance >= bestDistance {
			continue
		}

		bestFlower = flower
		bestDistance = distance
	}

	return bestFlower
}

func (hub *gameHub) findHiveInRangeLocked(x float64, y float64) *activeHiveRuntime {
	var (
		bestHive     *activeHiveRuntime
		bestDistance = math.Inf(1)
	)

	for _, hive := range hub.activeHives {
		if hive == nil || hive.Node == nil {
			continue
		}

		distance := math.Hypot(hive.Node.X-x, hive.Node.Y-y)
		if distance > hive.Node.DepositRadius || distance >= bestDistance {
			continue
		}

		bestHive = hive
		bestDistance = distance
	}

	return bestHive
}

func (hub *gameHub) updatePlayerZoneLocked(player *playerState, progress *loopbase.PlayerProgress) {
	if player == nil || progress == nil {
		return
	}

	progress.CurrentZoneID = hub.world.zoneIDAt(player.X, player.Y)
	progress.UpdatedAt = hub.now()
	player.LastSeenAt = hub.now()
}

func (hub *gameHub) addXPToProgressLocked(progress *loopbase.PlayerProgress, amount int) bool {
	if progress == nil || amount <= 0 {
		return false
	}

	progress.XP += amount
	leveledUp := false
	for progress.Level < int(progression.MaxLevel) {
		xpRequired := int(progression.CalculateXPRequiredForLevel(uint32(progress.Level)))
		if progress.XP < xpRequired {
			break
		}

		progress.XP -= xpRequired
		progress.Level++
		progress.SkillPoints++
		progress.PollenCapacity = progression.CalculatePollenCapacityForLevel(uint32(progress.Level))
		leveledUp = true
	}

	if progress.Level >= int(progression.MaxLevel) {
		progress.XP = 0
	}

	progress.UpdatedAt = hub.now()
	return leveledUp
}

func resolveFlowerLevel(x float64, y float64) int {
	return 1 + positiveModulo(int(hashUint32(quantizeMapCoord(x), quantizeMapCoord(y), 211)), 3)
}

func flowerYieldForLevel(level int) int {
	return 4 + level*4
}

func flowerXPForLevel(level int) int {
	return 10 + level*5
}

func flowerCollectDuration(level int) time.Duration {
	return time.Duration(700+level*450) * time.Millisecond
}

func positionKey(x float64, y float64) string {
	return fmt.Sprintf("%d:%d", quantizeMapCoord(x), quantizeMapCoord(y))
}

func (hub *gameHub) ensureCollectorHive() {
	if hub == nil {
		return
	}

	if existing := hub.activeHives[collectorHiveID]; existing != nil {
		existing.State.X = collectorHiveX
		existing.State.Y = collectorHiveY
		existing.State.Scale = collectorHiveScale
		existing.Node.X = collectorHiveX
		existing.Node.Y = collectorHiveY
		existing.Node.DepositRadius = collectorHiveDepositRadius
		return
	}

	chunkKey := buildChunkKey(worldAxisToChunk(collectorHiveX), worldAxisToChunk(collectorHiveY))
	hub.activeHives[collectorHiveID] = &activeHiveRuntime{
		ChunkKey: chunkKey,
		State: worldHiveState{
			ID:        collectorHiveID,
			X:         collectorHiveX,
			Y:         collectorHiveY,
			GroundY:   0,
			Scale:     collectorHiveScale,
			ToneColor: hiveTonePalette[0],
			GlowColor: hiveGlowPalette[2],
		},
		Node: &loopbase.HiveNode{
			ID:             collectorHiveID,
			X:              collectorHiveX,
			Y:              collectorHiveY,
			GroundY:        0,
			ZoneID:         hub.world.zoneIDAt(collectorHiveX, collectorHiveY),
			DepositRadius:  collectorHiveDepositRadius,
			ConversionRate: defaultHoneyConversionRate,
		},
	}
}
