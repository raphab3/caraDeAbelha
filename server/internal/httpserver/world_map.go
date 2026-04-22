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

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/zones"
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

type worldStageAudio struct {
	BGM string `json:"bgm"`
}

type worldBounds struct {
	X1 float64 `json:"x1"`
	X2 float64 `json:"x2"`
	Z1 float64 `json:"z1"`
	Z2 float64 `json:"z2"`
}

type worldEdgeBehavior struct {
	Type           string      `json:"type"`
	PlayableBounds worldBounds `json:"playableBounds"`
	OutlandsBounds worldBounds `json:"outlandsBounds"`
}

type worldPrefabPlacement struct {
	ID       string  `json:"id"`
	PrefabID string  `json:"prefabId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Scale    float64 `json:"scale"`
	Yaw      float64 `json:"yaw"`
	ZoneID   string  `json:"zoneId"`
	Tag      string  `json:"tag"`
}

type worldPrefabDefinition struct {
	ID           string
	AssetPath    string
	Category     string
	DefaultScale float64
	ColliderType string
}

type worldLandmark struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Z           float64 `json:"z"`
	ZoneID      string  `json:"zoneId"`
	Tag         string  `json:"tag"`
}

// worldMapContainer supports both legacy (array) and new (object) formats
type worldMapContainer struct {
	StageID      string                 `json:"stageId"`
	DisplayName  string                 `json:"displayName"`
	Audio        worldStageAudio        `json:"audio"`
	EdgeBehavior *worldEdgeBehavior     `json:"edgeBehavior"`
	Tiles        []worldMapRecord       `json:"tiles"`
	Props        []worldPrefabPlacement `json:"props"`
	Zones        []worldZone            `json:"zones"`
	Transitions  []worldTransition      `json:"transitions"`
	Landmarks    []worldLandmark        `json:"landmarks"`
}

type worldLayout struct {
	stageID      string
	displayName  string
	audio        worldStageAudio
	edgeBehavior *worldEdgeBehavior
	chunks       map[string]worldChunkState
	props        []worldPrefabPlacement
	zones        []worldZone
	transitions  []worldTransition
	landmarks    []worldLandmark
	hasBounds    bool
	minX         float64
	maxX         float64
	minY         float64
	maxY         float64
}

const fallbackSpawnHiveX = 6.5
const fallbackSpawnHiveY = 1.5
const outlandsReturnCompressionRatio = 0.25
const outlandsReturnMaxOffset = 18.0

var worldPrefabCatalog = map[string]worldPrefabDefinition{
	"terrain/cliff-high": {
		ID:           "terrain/cliff-high",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/block-grass-large-tall.glb",
		Category:     "terrain",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"terrain/slope-wide": {
		ID:           "terrain/slope-wide",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/block-grass-large-slope.glb",
		Category:     "terrain",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"terrain/overhang-edge": {
		ID:           "terrain/overhang-edge",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/block-grass-overhang-edge.glb",
		Category:     "terrain",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"nature/pine-large": {
		ID:           "nature/pine-large",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/tree-pine.glb",
		Category:     "nature",
		DefaultScale: 1,
		ColliderType: "soft",
	},
	"nature/flowers-cluster": {
		ID:           "nature/flowers-cluster",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/flowers.glb",
		Category:     "nature",
		DefaultScale: 1,
		ColliderType: "none",
	},
	"nature/rocks-cluster": {
		ID:           "nature/rocks-cluster",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/rocks.glb",
		Category:     "nature",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"setdressing/fence-broken": {
		ID:           "setdressing/fence-broken",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/fence-broken.glb",
		Category:     "setdressing",
		DefaultScale: 1,
		ColliderType: "soft",
	},
	"setdressing/signpost": {
		ID:           "setdressing/signpost",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/sign.glb",
		Category:     "setdressing",
		DefaultScale: 1,
		ColliderType: "soft",
	},
	"setdressing/platform": {
		ID:           "setdressing/platform",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/platform.glb",
		Category:     "setdressing",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"setdressing/platform-ramp": {
		ID:           "setdressing/platform-ramp",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/platform-ramp.glb",
		Category:     "setdressing",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"setdressing/platform-overhang": {
		ID:           "setdressing/platform-overhang",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/platform-overhang.glb",
		Category:     "setdressing",
		DefaultScale: 1,
		ColliderType: "solid",
	},
	"setdressing/fence-straight": {
		ID:           "setdressing/fence-straight",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/fence-straight.glb",
		Category:     "setdressing",
		DefaultScale: 1,
		ColliderType: "soft",
	},
	"landmark/flag-beacon": {
		ID:           "landmark/flag-beacon",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/flag.glb",
		Category:     "landmark",
		DefaultScale: 1.25,
		ColliderType: "soft",
	},
	"border/wind-gate": {
		ID:           "border/wind-gate",
		AssetPath:    "kenney_platformer-kit/Models/GLB format/arrows.glb",
		Category:     "border",
		DefaultScale: 1.4,
		ColliderType: "trigger",
	},
}

func resolveWorldPrefabDefinition(prefabID string) (worldPrefabDefinition, bool) {
	definition, ok := worldPrefabCatalog[strings.TrimSpace(prefabID)]
	return definition, ok
}

func normalizeWorldPrefabPlacement(placement worldPrefabPlacement) (worldPrefabPlacement, error) {
	placement.PrefabID = strings.TrimSpace(placement.PrefabID)
	if placement.PrefabID == "" {
		return worldPrefabPlacement{}, fmt.Errorf("prefab placement is missing prefabId")
	}

	definition, ok := resolveWorldPrefabDefinition(placement.PrefabID)
	if !ok {
		return worldPrefabPlacement{}, fmt.Errorf("unsupported prefabId %q", placement.PrefabID)
	}

	if strings.TrimSpace(placement.ID) == "" {
		placement.ID = fmt.Sprintf("prefab:%s:%d:%d", strings.ReplaceAll(placement.PrefabID, "/", ":"), quantizeMapCoord(placement.X), quantizeMapCoord(placement.Z))
	}

	if placement.Scale <= 0 {
		placement.Scale = definition.DefaultScale
	}

	placement.ZoneID = strings.TrimSpace(placement.ZoneID)
	placement.Tag = strings.TrimSpace(placement.Tag)

	return placement, nil
}

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
	rawProps := container.Props
	zones := container.Zones
	transitions := container.Transitions
	landmarks := container.Landmarks

	if len(records) == 0 {
		return worldLayout{}, fmt.Errorf("world map is empty")
	}

	props := make([]worldPrefabPlacement, 0, len(rawProps))
	for _, rawProp := range rawProps {
		normalizedProp, err := normalizeWorldPrefabPlacement(rawProp)
		if err != nil {
			return worldLayout{}, err
		}
		props = append(props, normalizedProp)
	}

	layout := worldLayout{
		stageID:      strings.TrimSpace(container.StageID),
		displayName:  strings.TrimSpace(container.DisplayName),
		audio:        container.Audio,
		edgeBehavior: container.EdgeBehavior,
		chunks:       make(map[string]worldChunkState),
		props:        append([]worldPrefabPlacement{}, props...),
		zones:        zones,
		transitions:  transitions,
		landmarks:    append([]worldLandmark{}, landmarks...),
		hasBounds:    true,
		minX:         math.Inf(1),
		maxX:         math.Inf(-1),
		minY:         math.Inf(1),
		maxY:         math.Inf(-1),
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

	for _, prop := range props {
		layout.minX = math.Min(layout.minX, prop.X)
		layout.maxX = math.Max(layout.maxX, prop.X)
		layout.minY = math.Min(layout.minY, prop.Z)
		layout.maxY = math.Max(layout.maxY, prop.Z)
	}

	for _, landmark := range landmarks {
		layout.minX = math.Min(layout.minX, landmark.X)
		layout.maxX = math.Max(layout.maxX, landmark.X)
		layout.minY = math.Min(layout.minY, landmark.Z)
		layout.maxY = math.Max(layout.maxY, landmark.Z)
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

	sort.Slice(layout.props, func(left int, right int) bool {
		if layout.props[left].PrefabID == layout.props[right].PrefabID {
			if layout.props[left].Z == layout.props[right].Z {
				return layout.props[left].X < layout.props[right].X
			}
			return layout.props[left].Z < layout.props[right].Z
		}
		return layout.props[left].PrefabID < layout.props[right].PrefabID
	})

	sort.Slice(layout.landmarks, func(left int, right int) bool {
		if layout.landmarks[left].DisplayName == layout.landmarks[right].DisplayName {
			return layout.landmarks[left].ID < layout.landmarks[right].ID
		}
		return layout.landmarks[left].DisplayName < layout.landmarks[right].DisplayName
	})

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
	bounds := layout.activeMovementBounds()
	return clampWorldAxisToBounds(x, bounds.X1, bounds.X2), clampWorldAxisToBounds(y, bounds.Z1, bounds.Z2)
}

func (layout worldLayout) activeMovementBounds() worldBounds {
	if layout.edgeBehavior != nil && strings.TrimSpace(layout.edgeBehavior.Type) == "outlands_return_corridor" && layout.edgeBehavior.OutlandsBounds.isValid() {
		return layout.edgeBehavior.OutlandsBounds
	}

	if layout.hasBounds {
		return worldBounds{X1: layout.minX, X2: layout.maxX, Z1: layout.minY, Z2: layout.maxY}
	}

	return worldBounds{}
}

func (layout worldLayout) playableBounds() worldBounds {
	if layout.edgeBehavior != nil && strings.TrimSpace(layout.edgeBehavior.Type) == "outlands_return_corridor" && layout.edgeBehavior.PlayableBounds.isValid() {
		return layout.edgeBehavior.PlayableBounds
	}

	return layout.activeMovementBounds()
}

func (layout worldLayout) outlandsDistanceFromPlayable(x float64, y float64) float64 {
	playable := layout.playableBounds()
	if !playable.isValid() {
		return 0
	}

	var distance float64
	if x < playable.X1 {
		distance += playable.X1 - x
	} else if x > playable.X2 {
		distance += x - playable.X2
	}

	if y < playable.Z1 {
		distance += playable.Z1 - y
	} else if y > playable.Z2 {
		distance += y - playable.Z2
	}

	return distance
}

func (layout worldLayout) remapReturnMovement(currentX float64, currentY float64, targetX float64, targetY float64) (float64, float64, float64, float64, bool) {
	if layout.edgeBehavior == nil || strings.TrimSpace(layout.edgeBehavior.Type) != "outlands_return_corridor" {
		return currentX, currentY, targetX, targetY, false
	}

	currentDistance := layout.outlandsDistanceFromPlayable(currentX, currentY)
	if currentDistance <= 0 {
		return currentX, currentY, targetX, targetY, false
	}

	targetDistance := layout.outlandsDistanceFromPlayable(targetX, targetY)
	if targetDistance >= currentDistance {
		return currentX, currentY, targetX, targetY, false
	}

	playable := layout.playableBounds()
	return remapOutlandsCoordinate(currentX, playable.X1, playable.X2),
		remapOutlandsCoordinate(currentY, playable.Z1, playable.Z2),
		remapOutlandsCoordinate(targetX, playable.X1, playable.X2),
		remapOutlandsCoordinate(targetY, playable.Z1, playable.Z2),
		true
}

func (layout worldLayout) zoneIDAt(x float64, y float64) string {
	for _, zone := range layout.zones {
		if x >= zone.X1 && x <= zone.X2 && y >= zone.Z1 && y <= zone.Z2 {
			if strings.TrimSpace(zone.ID) != "" {
				return zones.NormalizeZoneID(zone.ID)
			}
		}
	}

	return zones.DefaultCurrentZoneID()
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

func (bounds worldBounds) isValid() bool {
	return bounds.X1 < bounds.X2 && bounds.Z1 < bounds.Z2
}

func remapOutlandsCoordinate(value float64, min float64, max float64) float64 {
	if value < min {
		return min - math.Min((min-value)*outlandsReturnCompressionRatio, outlandsReturnMaxOffset)
	}

	if value > max {
		return max + math.Min((value-max)*outlandsReturnCompressionRatio, outlandsReturnMaxOffset)
	}

	return value
}
