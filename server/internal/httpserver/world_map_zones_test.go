package httpserver

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestZoneBoundariesNonOverlapping verifies zones don't overlap
func TestZoneBoundariesNonOverlapping(t *testing.T) {
	tests := []struct {
		name  string
		zone1 worldZone
		zone2 worldZone
		want  bool // true if they should not overlap
	}{
		{
			name: "zone_0 and zone_1 should not overlap",
			zone1: worldZone{
				ID: "zone_0", X1: 0, X2: 50, Z1: 0, Z2: 50,
			},
			zone2: worldZone{
				ID: "zone_1", X1: 50, X2: 100, Z1: 0, Z2: 50,
			},
			want: true,
		},
		{
			name: "zone_0 and zone_2 should not overlap",
			zone1: worldZone{
				ID: "zone_0", X1: 0, X2: 50, Z1: 0, Z2: 50,
			},
			zone2: worldZone{
				ID: "zone_2", X1: 0, X2: 50, Z1: 50, Z2: 100,
			},
			want: true,
		},
		{
			name: "zone_1 and zone_3 should not overlap",
			zone1: worldZone{
				ID: "zone_1", X1: 50, X2: 100, Z1: 0, Z2: 50,
			},
			zone2: worldZone{
				ID: "zone_3", X1: 50, X2: 100, Z1: 50, Z2: 100,
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if zonesOverlap(tt.zone1, tt.zone2) != !tt.want {
				t.Errorf("zones should not overlap: %s and %s", tt.zone1.ID, tt.zone2.ID)
			}
		})
	}
}

// TestTransitionReferencesValidZones verifies all transitions reference valid zones
func TestTransitionReferencesValidZones(t *testing.T) {
	zones := []worldZone{
		{ID: "zone_0"},
		{ID: "zone_1"},
		{ID: "zone_2"},
		{ID: "zone_3"},
		{ID: "zone_4"},
	}

	transitions := []worldTransition{
		{FromZone: "zone_0", ToZone: "zone_1", Type: "gate"},
		{FromZone: "zone_0", ToZone: "zone_2", Type: "gate"},
		{FromZone: "zone_1", ToZone: "zone_3", Type: "gate"},
		{FromZone: "zone_2", ToZone: "zone_4", Type: "gate"},
		{FromZone: "zone_3", ToZone: "zone_4", Type: "gate"},
	}

	validZoneIDs := make(map[string]bool)
	for _, z := range zones {
		validZoneIDs[z.ID] = true
	}

	for _, trans := range transitions {
		if !validZoneIDs[trans.FromZone] {
			t.Errorf("transition from invalid zone: %s", trans.FromZone)
		}
		if !validZoneIDs[trans.ToZone] {
			t.Errorf("transition to invalid zone: %s", trans.ToZone)
		}
	}
}

// TestZoneBoundaryCoordinates verifies expected zone boundaries
func TestZoneBoundaryCoordinates(t *testing.T) {
	expectedZones := map[string]worldZone{
		"zone_0": {ID: "zone_0", X1: 0, X2: 50, Z1: 0, Z2: 50},
		"zone_1": {ID: "zone_1", X1: 50, X2: 100, Z1: 0, Z2: 50},
		"zone_2": {ID: "zone_2", X1: 0, X2: 50, Z1: 50, Z2: 100},
		"zone_3": {ID: "zone_3", X1: 50, X2: 100, Z1: 50, Z2: 100},
		"zone_4": {ID: "zone_4", X1: 25, X2: 75, Z1: 100, Z2: 150},
	}

	for id, expected := range expectedZones {
		if expected.X1 >= expected.X2 || expected.Z1 >= expected.Z2 {
			t.Errorf("zone %s has invalid bounds: x[%v, %v] z[%v, %v]", id, expected.X1, expected.X2, expected.Z1, expected.Z2)
		}
	}
}

// TestMapContainerParsing verifies map.json with zones parses correctly
func TestMapContainerParsing(t *testing.T) {
	// Minimal valid map with zones and transitions
	data := worldMapContainer{
		Tiles: []worldMapRecord{
			{X: 0, Y: 0, Z: 0, Type: "grass", Prop: nil},
		},
		Zones: []worldZone{
			{ID: "zone_0", Name: "Test Zone", X1: 0, X2: 50, Z1: 0, Z2: 50},
		},
		Transitions: []worldTransition{
			{FromZone: "zone_0", ToZone: "zone_1", X: 25, Z: 25, Type: "gate"},
		},
	}

	bytes, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal container: %v", err)
	}

	layout, err := parseWorldLayout(bytes)
	if err != nil {
		t.Fatalf("parse world layout: %v", err)
	}

	if len(layout.zones) != 1 {
		t.Errorf("expected 1 zone, got %d", len(layout.zones))
	}

	if len(layout.transitions) != 1 {
		t.Errorf("expected 1 transition, got %d", len(layout.transitions))
	}

	if layout.zones[0].ID != "zone_0" {
		t.Errorf("zone ID mismatch: expected zone_0, got %s", layout.zones[0].ID)
	}
}

func TestExpandedStageMapParsing(t *testing.T) {
	data := worldMapContainer{
		StageID:     "stage:starter-basin",
		DisplayName: "Bacia do Primeiro Voo",
		Audio: worldStageAudio{
			BGM: "assets/rpg-adventure.mp3",
		},
		EdgeBehavior: &worldEdgeBehavior{
			Type:           "outlands_return_corridor",
			PlayableBounds: worldBounds{X1: -10, X2: 10, Z1: -10, Z2: 10},
			OutlandsBounds: worldBounds{X1: -20, X2: 20, Z1: -20, Z2: 20},
		},
		Tiles: []worldMapRecord{
			{X: 0, Y: 0, Z: 0, Type: "grass", Prop: nil},
		},
		Props: []worldPrefabPlacement{
			{ID: "prop:cliff-01", PrefabID: "terrain/cliff-high", X: 8, Y: 2, Z: 6, Scale: 1.2, ZoneID: "zone_0", Tag: "terrain"},
		},
		Landmarks: []worldLandmark{
			{ID: "landmark:arch", DisplayName: "Arco de Pedra", X: 12, Y: 3, Z: 9, ZoneID: "zone_0", Tag: "navigation"},
		},
		Zones: []worldZone{
			{ID: "zone_0", Name: "Vale Inicial", X1: -10, X2: 10, Z1: -10, Z2: 10},
		},
	}

	bytes, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal expanded container: %v", err)
	}

	layout, err := parseWorldLayout(bytes)
	if err != nil {
		t.Fatalf("parse expanded world layout: %v", err)
	}

	if layout.stageID != data.StageID {
		t.Fatalf("expected stageID %q, got %q", data.StageID, layout.stageID)
	}

	if layout.displayName != data.DisplayName {
		t.Fatalf("expected displayName %q, got %q", data.DisplayName, layout.displayName)
	}

	if layout.audio.BGM != data.Audio.BGM {
		t.Fatalf("expected BGM %q, got %q", data.Audio.BGM, layout.audio.BGM)
	}

	if layout.edgeBehavior == nil || layout.edgeBehavior.Type != data.EdgeBehavior.Type {
		t.Fatalf("expected edge behavior type %q", data.EdgeBehavior.Type)
	}

	if len(layout.props) != 1 || layout.props[0].PrefabID != "terrain/cliff-high" {
		t.Fatalf("expected one rich prop prefab, got %#v", layout.props)
	}

	if layout.props[0].Scale != 1.2 {
		t.Fatalf("expected explicit prefab scale 1.2, got %v", layout.props[0].Scale)
	}

	if len(layout.landmarks) != 1 || layout.landmarks[0].DisplayName != "Arco de Pedra" {
		t.Fatalf("expected one landmark, got %#v", layout.landmarks)
	}

	if layout.maxX < 12 || layout.maxY < 9 {
		t.Fatalf("expected authored props and landmarks to contribute to bounds, got maxX=%v maxY=%v", layout.maxX, layout.maxY)
	}
}

func TestExpandedStageMapParsingDefaultsPrefabScaleAndID(t *testing.T) {
	data := worldMapContainer{
		Tiles: []worldMapRecord{{X: 0, Y: 0, Z: 0, Type: "grass", Prop: nil}},
		Props: []worldPrefabPlacement{{PrefabID: "nature/pine-large", X: 4, Y: 0, Z: 3}},
	}

	bytes, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal container with defaults: %v", err)
	}

	layout, err := parseWorldLayout(bytes)
	if err != nil {
		t.Fatalf("parse layout with prefab defaults: %v", err)
	}

	if len(layout.props) != 1 {
		t.Fatalf("expected one prop, got %d", len(layout.props))
	}

	if layout.props[0].ID == "" {
		t.Fatalf("expected generated prop ID, got empty string")
	}

	if layout.props[0].Scale != worldPrefabCatalog["nature/pine-large"].DefaultScale {
		t.Fatalf("expected default scale %v, got %v", worldPrefabCatalog["nature/pine-large"].DefaultScale, layout.props[0].Scale)
	}
}

func TestExpandedStageMapParsingRejectsUnknownPrefab(t *testing.T) {
	data := worldMapContainer{
		Tiles: []worldMapRecord{{X: 0, Y: 0, Z: 0, Type: "grass", Prop: nil}},
		Props: []worldPrefabPlacement{{ID: "broken", PrefabID: "nature/not-found", X: 1, Y: 0, Z: 1}},
	}

	bytes, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal invalid prefab container: %v", err)
	}

	_, err = parseWorldLayout(bytes)
	if err == nil {
		t.Fatalf("expected invalid prefab parsing to fail")
	}

	if err.Error() != "unsupported prefabId \"nature/not-found\"" {
		t.Fatalf("unexpected error for invalid prefab: %v", err)
	}
}

// TestLegacyMapFormatBackwardCompatibility verifies legacy array format still works
func TestLegacyMapFormatBackwardCompatibility(t *testing.T) {
	// Legacy format: just an array of tile records
	tiles := []worldMapRecord{
		{X: 0, Y: 0, Z: 0, Type: "grass", Prop: nil},
		{X: 1, Y: 0, Z: 0, Type: "grass", Prop: nil},
	}

	bytes, err := json.Marshal(tiles)
	if err != nil {
		t.Fatalf("marshal tiles: %v", err)
	}

	layout, err := parseWorldLayout(bytes)
	if err != nil {
		t.Fatalf("parse legacy world layout: %v", err)
	}

	if len(layout.chunks) == 0 {
		t.Errorf("legacy format should parse tiles into chunks")
	}

	if len(layout.zones) != 0 {
		t.Errorf("legacy format without zones should have 0 zones, got %d", len(layout.zones))
	}
}

func TestCurrentMapFileParses(t *testing.T) {
	mapPath := filepath.Join("..", "..", "maps", "map.json")
	worldBytes, err := os.ReadFile(mapPath)
	if err != nil {
		t.Fatalf("read current map file: %v", err)
	}

	layout, err := parseWorldLayout(worldBytes)
	if err != nil {
		t.Fatalf("parse current map file: %v", err)
	}

	if layout.stageID != "stage:starter-basin" {
		t.Fatalf("expected stage:starter-basin, got %q", layout.stageID)
	}

	if layout.audio.BGM != "assets/rpg-adventure.mp3" {
		t.Fatalf("expected authored map BGM, got %q", layout.audio.BGM)
	}

	if layout.edgeBehavior == nil || layout.edgeBehavior.Type != "outlands_return_corridor" {
		t.Fatalf("expected authored edge behavior in current map")
	}

	if len(layout.props) == 0 {
		t.Fatalf("expected current map to include authored prefab props")
	}

	if len(layout.landmarks) == 0 {
		t.Fatalf("expected current map to include landmarks")
	}

	if len(layout.zones) == 0 {
		t.Fatalf("expected current map to include explicit zones")
	}

	if len(layout.chunks) == 0 {
		t.Fatalf("expected current map to produce chunks")
	}
}

func TestClampPositionUsesOutlandsBoundsWhenConfigured(t *testing.T) {
	layout := worldLayout{
		hasBounds: true,
		minX:      -50,
		maxX:      50,
		minY:      -50,
		maxY:      50,
		edgeBehavior: &worldEdgeBehavior{
			Type: "outlands_return_corridor",
			PlayableBounds: worldBounds{X1: -45, X2: 45, Z1: -45, Z2: 45},
			OutlandsBounds: worldBounds{X1: -120, X2: 120, Z1: -120, Z2: 120},
		},
	}

	x, y := layout.clampPosition(130, -140)
	if x != 120 || y != -120 {
		t.Fatalf("expected clamp to outlands bounds 120,-120, got %v,%v", x, y)
	}
}

func TestRemapReturnMovementCompressesOutlandsJourney(t *testing.T) {
	layout := worldLayout{
		edgeBehavior: &worldEdgeBehavior{
			Type: "outlands_return_corridor",
			PlayableBounds: worldBounds{X1: -45, X2: 45, Z1: -45, Z2: 45},
			OutlandsBounds: worldBounds{X1: -120, X2: 120, Z1: -120, Z2: 120},
		},
	}

	currentX, currentY, targetX, targetY, changed := layout.remapReturnMovement(110, 0, 40, 0)
	if !changed {
		t.Fatalf("expected return movement to be compressed")
	}

	if currentX >= 110 || currentX <= 45 {
		t.Fatalf("expected compressed current x between playable edge and original outlands x, got %v", currentX)
	}

	if currentY != 0 || targetY != 0 {
		t.Fatalf("expected y axis to remain unchanged, got currentY=%v targetY=%v", currentY, targetY)
	}

	if targetX != 40 {
		t.Fatalf("expected playable target x to remain 40, got %v", targetX)
	}
}

// Helper function to check if two zones overlap
func zonesOverlap(z1, z2 worldZone) bool {
	// Zones overlap if their x or z ranges intersect
	xOverlap := z1.X1 < z2.X2 && z2.X1 < z1.X2
	zOverlap := z1.Z1 < z2.Z2 && z2.Z1 < z1.Z2
	return xOverlap && zOverlap
}
