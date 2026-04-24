package httpserver

import (
	"fmt"
	"math"
	"sort"
)

var flowerPetalPalette = []string{"#fff2a1", "#ffd4ef", "#d8ffd0", "#ffe0b2", "#f6f1ff"}
var flowerCorePalette = []string{"#8d5519", "#774011", "#5f360f"}
var hiveTonePalette = []string{"#a86a18", "#b9821c", "#94611a"}
var hiveGlowPalette = []string{"#ffd96a", "#ffbf45", "#ffe89d"}

func (hub *gameHub) snapshotForPlayerLocked(viewer *playerState) worldStateMessage {
	centerChunkX, centerChunkY := playerChunkPosition(viewer)

	// Todos os jogadores são sempre incluídos; o cliente filtra por distância no render 3D.
	players := make([]playerState, 0, len(hub.players))
	for _, player := range hub.players {
		progress := hub.ensurePlayerProgressLocked(player.ID)
		hub.ensurePlayerCombatLocked(player, progress, hub.now())
		players = append(players, *player)
	}

	sort.Slice(players, func(left int, right int) bool {
		return players[left].ID < players[right].ID
	})

	return worldStateMessage{
		Type:           "state",
		Tick:           hub.tick,
		StageID:        hub.world.stageID,
		StageName:      hub.world.displayName,
		AudioBGM:       hub.world.audio.BGM,
		Players:        players,
		Chunks:         hub.buildVisibleChunksLocked(centerChunkX, centerChunkY),
		Props:          hub.buildWorldPropsState(),
		Landmarks:      hub.buildWorldLandmarksState(),
		CenterChunkX:   centerChunkX,
		CenterChunkY:   centerChunkY,
		RenderDistance: worldRenderDistance,
		ChunkSize:      worldChunkSize,
	}
}

func (hub *gameHub) buildWorldPropsState() []worldPropState {
	if len(hub.world.props) == 0 {
		return nil
	}

	props := make([]worldPropState, 0, len(hub.world.props))
	for _, prop := range hub.world.props {
		definition, _ := resolveWorldPrefabDefinition(prop.PrefabID)
		props = append(props, worldPropState{
			ID:        prop.ID,
			PrefabID:  prop.PrefabID,
			AssetPath: definition.AssetPath,
			Category:  definition.Category,
			X:         prop.X,
			Y:         prop.Y,
			Z:         prop.Z,
			Scale:     prop.Scale,
			Yaw:       prop.Yaw,
			ZoneID:    prop.ZoneID,
			Tag:       prop.Tag,
		})
	}

	return props
}

func (hub *gameHub) buildWorldLandmarksState() []worldLandmarkState {
	if len(hub.world.landmarks) == 0 {
		return nil
	}

	landmarks := make([]worldLandmarkState, 0, len(hub.world.landmarks))
	for _, landmark := range hub.world.landmarks {
		landmarks = append(landmarks, worldLandmarkState{
			ID:          landmark.ID,
			DisplayName: landmark.DisplayName,
			X:           landmark.X,
			Y:           landmark.Y,
			Z:           landmark.Z,
			ZoneID:      landmark.ZoneID,
			Tag:         landmark.Tag,
		})
	}

	return landmarks
}

func buildPlayerID(profileKey string) string {
	return "player:" + profileKey
}

func buildChunkKey(chunkX int, chunkY int) string {
	return fmt.Sprintf("chunk:%d:%d", chunkX, chunkY)
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
	tiles := make([]worldTileState, 0, int(worldChunkSize)*int(worldChunkSize))

	for cellX := 0; cellX < int(worldChunkSize); cellX++ {
		for cellY := 0; cellY < int(worldChunkSize); cellY++ {
			tileX := originX + float64(cellX) + 0.5
			tileY := originY + float64(cellY) + 0.5

			tiles = append(tiles, worldTileState{
				ID:   fmt.Sprintf("tile:%d:%d:%d:%d", chunkX, chunkY, cellX, cellY),
				X:    tileX,
				Y:    0,
				Z:    tileY,
				Type: "grass",
			})
		}
	}

	flowerCount := 3 + positiveModulo(int(hashUint32(chunkX, chunkY, 1)), 3)
	flowers := make([]worldFlowerState, 0, flowerCount)

	for index := 0; index < flowerCount; index++ {
		flowers = append(flowers, worldFlowerState{
			ID:         fmt.Sprintf("flower:%d:%d:%d", chunkX, chunkY, index),
			X:          originX + hashRange(worldDecorationPadding, worldChunkSize-worldDecorationPadding, chunkX, chunkY, index, 11),
			Y:          originY + hashRange(worldDecorationPadding, worldChunkSize-worldDecorationPadding, chunkX, chunkY, index, 23),
			GroundY:    0,
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
			GroundY:   0,
			Scale:     hashRange(0.92, 1.24, chunkX, chunkY, 0, 151),
			ToneColor: hiveTonePalette[positiveModulo(int(hashUint32(chunkX, chunkY, 0, 163)), len(hiveTonePalette))],
			GlowColor: hiveGlowPalette[positiveModulo(int(hashUint32(chunkX, chunkY, 0, 173)), len(hiveGlowPalette))],
		})
	}

	return worldChunkState{
		Key:     buildChunkKey(chunkX, chunkY),
		X:       chunkX,
		Y:       chunkY,
		Tiles:   tiles,
		Flowers: flowers,
		Trees:   []worldTreeState{},
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

func clampToWorld(value float64) float64 {
	return value
}
