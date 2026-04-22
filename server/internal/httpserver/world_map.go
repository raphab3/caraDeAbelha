package httpserver

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const worldMapEnvVar = "CARA_DE_ABELHA_MAP_PATH"

type worldMapRecord struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Z    float64 `json:"z"`
	Type string  `json:"type"`
	Prop *string `json:"prop"`
}

type worldZone struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	X1   float64 `json:"x1"`
	X2   float64 `json:"x2"`
	Z1   float64 `json:"z1"`
	Z2   float64 `json:"z2"`
}

type worldTransition struct {
	FromZone string  `json:"fromZone"`
	ToZone   string  `json:"toZone"`
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Type     string  `json:"type"`
}

// worldMapContainer supports both legacy (array) and new (object) formats
type worldMapContainer struct {
	Tiles       []worldMapRecord  `json:"tiles"`
	Zones       []worldZone       `json:"zones"`
	Transitions []worldTransition `json:"transitions"`
}

type worldLayout struct {
	chunks      map[string]worldChunkState
	zones       []worldZone
	transitions []worldTransition
	hasBounds   bool
	minX        float64
	maxX        float64
	minY        float64
	maxY        float64
}

const fallbackSpawnHiveX = 6.5
const fallbackSpawnHiveY = 1.5

func loadWorldLayout() worldLayout {
	mapPath, err := resolveWorldMapPath()
	if err != nil {
		log.Printf("world map not found, using procedural world: %v", err)
		return worldLayout{}
	}

	worldBytes, err := os.ReadFile(mapPath)
	if err != nil {
		log.Printf("failed to read world map at %s, using procedural world: %v", mapPath, err)
		return worldLayout{}
	}

	layout, err := parseWorldLayout(worldBytes)
	if err != nil {
		log.Printf("failed to parse world map at %s, using procedural world: %v", mapPath, err)
		return worldLayout{}
	}

	log.Printf("loaded world map from %s with %d chunks", mapPath, len(layout.chunks))
	return layout
}

func resolveWorldMapPath() (string, error) {
	if overridePath := strings.TrimSpace(os.Getenv(worldMapEnvVar)); overridePath != "" {
		if fileInfo, err := os.Stat(overridePath); err == nil && !fileInfo.IsDir() {
			return overridePath, nil
		}

		return "", fmt.Errorf("override path %q does not exist", overridePath)
	}

	workingDir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("resolve current working directory: %w", err)
	}

	searchRoots := []string{workingDir}
	currentRoot := workingDir
	for depth := 0; depth < 5; depth++ {
		parent := filepath.Dir(currentRoot)
		if parent == currentRoot {
			break
		}

		searchRoots = append(searchRoots, parent)
		currentRoot = parent
	}

	for _, root := range searchRoots {
		for _, relativePath := range []string{"maps/map.json", filepath.Join("server", "maps", "map.json")} {
			candidate := filepath.Join(root, relativePath)
			fileInfo, statErr := os.Stat(candidate)
			if statErr != nil || fileInfo.IsDir() {
				continue
			}

			return candidate, nil
		}
	}

	return "", fmt.Errorf("maps/map.json not found from %s", workingDir)
}

func parseWorldLayout(worldBytes []byte) (worldLayout, error) {
	// Try to parse as new format (object with tiles, zones, transitions)
	var container worldMapContainer
	if err := json.Unmarshal(worldBytes, &container); err == nil && len(container.Tiles) > 0 {
		// Successfully parsed new format
		return parseWorldLayoutFromContainer(container)
	}

	// Fall back to legacy format (array of tiles only)
	var records []worldMapRecord
	if err := json.Unmarshal(worldBytes, &records); err != nil {
		return worldLayout{}, fmt.Errorf("decode world map json: %w", err)
	}

	if len(records) == 0 {
		return worldLayout{}, fmt.Errorf("world map is empty")
	}

	// Wrap legacy records in container format
	return parseWorldLayoutFromContainer(worldMapContainer{Tiles: records})
}

func parseWorldLayoutFromContainer(container worldMapContainer) (worldLayout, error) {
	records := container.Tiles
	zones := container.Zones
	transitions := container.Transitions

	if len(records) == 0 {
		return worldLayout{}, fmt.Errorf("world map is empty")
	}

	layout := worldLayout{
		chunks:      make(map[string]worldChunkState),
		zones:       zones,
		transitions: transitions,
		hasBounds:   true,
		minX:        math.Inf(1),
		maxX:        math.Inf(-1),
		minY:        math.Inf(1),
		maxY:        math.Inf(-1),
	}

	for _, record := range records {
		tileType := strings.ToLower(strings.TrimSpace(record.Type))
		if tileType != "grass" && tileType != "water" && tileType != "stone" {
			return worldLayout{}, fmt.Errorf("unsupported tile type %q", record.Type)
		}

		propType := ""
		if record.Prop != nil {
			propType = strings.ToLower(strings.TrimSpace(*record.Prop))
			if propType != "" && propType != "flower" && propType != "tree" && propType != "hive" {
				return worldLayout{}, fmt.Errorf("unsupported prop type %q", *record.Prop)
			}
		}

		tileCenterX := record.X + 0.5
		tileCenterY := record.Z + 0.5
		chunkX := worldAxisToChunk(record.X)
		chunkY := worldAxisToChunk(record.Z)
		chunkKey := buildChunkKey(chunkX, chunkY)
		chunk := layout.chunks[chunkKey]

		if chunk.Key == "" {
			chunk = worldChunkState{
				Key:     chunkKey,
				X:       chunkX,
				Y:       chunkY,
				Tiles:   []worldTileState{},
				Flowers: []worldFlowerState{},
				Trees:   []worldTreeState{},
				Hives:   []worldHiveState{},
			}
		}

		chunk.Tiles = append(chunk.Tiles, worldTileState{
			ID:   fmt.Sprintf("tile:%d:%d", quantizeMapCoord(record.X), quantizeMapCoord(record.Z)),
			X:    tileCenterX,
			Y:    record.Y,
			Z:    tileCenterY,
			Type: tileType,
		})

		switch propType {
		case "flower":
			seedX := quantizeMapCoord(record.X)
			seedY := quantizeMapCoord(record.Z)
			chunk.Flowers = append(chunk.Flowers, worldFlowerState{
				ID:         fmt.Sprintf("flower:%d:%d", seedX, seedY),
				X:          tileCenterX,
				Y:          tileCenterY,
				GroundY:    record.Y,
				Scale:      hashRange(0.84, 1.18, seedX, seedY, 31),
				PetalColor: flowerPetalPalette[positiveModulo(int(hashUint32(seedX, seedY, 41)), len(flowerPetalPalette))],
				CoreColor:  flowerCorePalette[positiveModulo(int(hashUint32(seedX, seedY, 53)), len(flowerCorePalette))],
			})
		case "tree":
			seedX := quantizeMapCoord(record.X)
			seedY := quantizeMapCoord(record.Z)
			chunk.Trees = append(chunk.Trees, worldTreeState{
				ID:      fmt.Sprintf("tree:%d:%d", seedX, seedY),
				X:       tileCenterX,
				Y:       tileCenterY,
				GroundY: record.Y,
				Scale:   hashRange(0.92, 1.3, seedX, seedY, 67),
			})
		case "hive":
			seedX := quantizeMapCoord(record.X)
			seedY := quantizeMapCoord(record.Z)
			chunk.Hives = append(chunk.Hives, worldHiveState{
				ID:        fmt.Sprintf("hive:%d:%d", seedX, seedY),
				X:         tileCenterX,
				Y:         tileCenterY,
				GroundY:   record.Y,
				Scale:     hashRange(0.96, 1.12, seedX, seedY, 83),
				ToneColor: hiveTonePalette[positiveModulo(int(hashUint32(seedX, seedY, 163)), len(hiveTonePalette))],
				GlowColor: hiveGlowPalette[positiveModulo(int(hashUint32(seedX, seedY, 173)), len(hiveGlowPalette))],
			})
		}

		layout.chunks[chunkKey] = chunk
		layout.minX = math.Min(layout.minX, tileCenterX)
		layout.maxX = math.Max(layout.maxX, tileCenterX)
		layout.minY = math.Min(layout.minY, tileCenterY)
		layout.maxY = math.Max(layout.maxY, tileCenterY)
	}

	for chunkKey, chunk := range layout.chunks {
		sort.Slice(chunk.Tiles, func(left int, right int) bool {
			if chunk.Tiles[left].Z == chunk.Tiles[right].Z {
				return chunk.Tiles[left].X < chunk.Tiles[right].X
			}

			return chunk.Tiles[left].Z < chunk.Tiles[right].Z
		})
		sort.Slice(chunk.Flowers, func(left int, right int) bool {
			return chunk.Flowers[left].ID < chunk.Flowers[right].ID
		})
		sort.Slice(chunk.Trees, func(left int, right int) bool {
			return chunk.Trees[left].ID < chunk.Trees[right].ID
		})
		sort.Slice(chunk.Hives, func(left int, right int) bool {
			return chunk.Hives[left].ID < chunk.Hives[right].ID
		})
		layout.chunks[chunkKey] = chunk
	}

	ensureFallbackSpawnHive(&layout)

	return layout, nil
}

func ensureFallbackSpawnHive(layout *worldLayout) {
	if layout == nil || len(layout.chunks) == 0 {
		return
	}

	for _, chunk := range layout.chunks {
		if len(chunk.Hives) > 0 {
			return
		}
	}

	chunkX := worldAxisToChunk(fallbackSpawnHiveX)
	chunkY := worldAxisToChunk(fallbackSpawnHiveY)
	chunkKey := buildChunkKey(chunkX, chunkY)
	chunk, ok := layout.chunks[chunkKey]
	if !ok {
		return
	}

	chunk.Hives = append(chunk.Hives, worldHiveState{
		ID:        "hive:spawn",
		X:         fallbackSpawnHiveX,
		Y:         fallbackSpawnHiveY,
		GroundY:   0,
		Scale:     1.08,
		ToneColor: hiveTonePalette[0],
		GlowColor: hiveGlowPalette[0],
	})

	sort.Slice(chunk.Hives, func(left int, right int) bool {
		return chunk.Hives[left].ID < chunk.Hives[right].ID
	})

	layout.chunks[chunkKey] = chunk
}

func (layout worldLayout) visibleChunksAround(centerChunkX int, centerChunkY int) []worldChunkState {
	if len(layout.chunks) == 0 {
		return visibleChunksAround(centerChunkX, centerChunkY)
	}

	chunks := make([]worldChunkState, 0, (worldRenderDistance*2+1)*(worldRenderDistance*2+1))
	for chunkY := centerChunkY - worldRenderDistance; chunkY <= centerChunkY+worldRenderDistance; chunkY++ {
		for chunkX := centerChunkX - worldRenderDistance; chunkX <= centerChunkX+worldRenderDistance; chunkX++ {
			chunkKey := buildChunkKey(chunkX, chunkY)
			if chunk, ok := layout.chunks[chunkKey]; ok {
				chunks = append(chunks, chunk)
				continue
			}

			chunks = append(chunks, worldChunkState{
				Key:     chunkKey,
				X:       chunkX,
				Y:       chunkY,
				Tiles:   []worldTileState{},
				Flowers: []worldFlowerState{},
				Trees:   []worldTreeState{},
				Hives:   []worldHiveState{},
			})
		}
	}

	return chunks
}

func (layout worldLayout) clampPosition(x float64, y float64) (float64, float64) {
	if !layout.hasBounds {
		return x, y
	}

	return clampWorldAxisToBounds(x, layout.minX, layout.maxX), clampWorldAxisToBounds(y, layout.minY, layout.maxY)
}

func quantizeMapCoord(value float64) int {
	return int(math.Round(value * 100))
}

func clampWorldAxisToBounds(value float64, min float64, max float64) float64 {
	if value < min {
		return min
	}

	if value > max {
		return max
	}

	return value
}
