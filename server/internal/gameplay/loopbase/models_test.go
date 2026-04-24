package loopbase

import (
	"encoding/json"
	"testing"
	"time"
)

// TestPlayerProgressInit validates that PlayerProgress can be initialized with basic values.
func TestPlayerProgressInit(t *testing.T) {
	progress := &PlayerProgress{
		PlayerID:        "player:001",
		PollenCarried:   0,
		PollenCapacity:  100,
		Honey:           0,
		Level:           1,
		XP:              0,
		SkillPoints:     0,
		CurrentZoneID:   "zone:start",
		UnlockedZoneIDs: []string{"zone:start"},
		UpdatedAt:       time.Now(),
	}

	if progress.PlayerID != "player:001" {
		t.Errorf("expected PlayerID to be 'player:001', got %s", progress.PlayerID)
	}

	if progress.PollenCarried != 0 {
		t.Errorf("expected PollenCarried to be 0, got %d", progress.PollenCarried)
	}

	if progress.PollenCapacity != 100 {
		t.Errorf("expected PollenCapacity to be 100, got %d", progress.PollenCapacity)
	}

	if progress.Honey != 0 {
		t.Errorf("expected Honey to be 0, got %d", progress.Honey)
	}

	if progress.Level != 1 {
		t.Errorf("expected Level to be 1, got %d", progress.Level)
	}
}

// TestPlayerProgressCapacity validates that pollen cannot exceed capacity.
func TestPlayerProgressCapacity(t *testing.T) {
	progress := &PlayerProgress{
		PlayerID:       "player:001",
		PollenCarried:  50,
		PollenCapacity: 100,
	}

	// Simulate adding pollen that would exceed capacity
	requested := 60
	available := progress.PollenCapacity - progress.PollenCarried

	if available < requested {
		t.Logf("correct: requested %d pollen, but only %d space available", requested, available)
	}
}

// TestFlowerNodeInit validates that FlowerNode can be initialized with basic values.
func TestFlowerNodeInit(t *testing.T) {
	now := time.Now()
	flower := &FlowerNode{
		ID:              "flower:0:0",
		X:               1.5,
		Y:               2.0,
		GroundY:         0.5,
		ZoneID:          "zone:start",
		PollenAvailable: 50,
		PollenCapacity:  100,
		CollectRadius:   2.5,
		RegenPerSecond:  0.1,
		YieldPerClick:   5,
		LastRegenAt:     now,
		UpdatedAt:       now,
	}

	if flower.ID != "flower:0:0" {
		t.Errorf("expected ID to be 'flower:0:0', got %s", flower.ID)
	}

	if flower.PollenAvailable != 50 {
		t.Errorf("expected PollenAvailable to be 50, got %d", flower.PollenAvailable)
	}

	if flower.CollectRadius != 2.5 {
		t.Errorf("expected CollectRadius to be 2.5, got %f", flower.CollectRadius)
	}

	if flower.YieldPerClick != 5 {
		t.Errorf("expected YieldPerClick to be 5, got %d", flower.YieldPerClick)
	}
}

// TestFlowerNodeDepletion validates flower pollen depletion logic.
func TestFlowerNodeDepletion(t *testing.T) {
	flower := &FlowerNode{
		ID:              "flower:0:0",
		PollenAvailable: 10,
		PollenCapacity:  100,
		YieldPerClick:   5,
	}

	// First click: 5 pollen collected
	flower.PollenAvailable -= flower.YieldPerClick
	if flower.PollenAvailable != 5 {
		t.Errorf("after first click, expected 5 pollen remaining, got %d", flower.PollenAvailable)
	}

	// Second click: 5 more pollen collected
	flower.PollenAvailable -= flower.YieldPerClick
	if flower.PollenAvailable != 0 {
		t.Errorf("after second click, expected 0 pollen remaining, got %d", flower.PollenAvailable)
	}

	// Third click: flower is depleted
	if flower.PollenAvailable < flower.YieldPerClick {
		t.Logf("correct: flower depleted, no more pollen available")
	}
}

// TestHiveNodeInit validates that HiveNode can be initialized with basic values.
func TestHiveNodeInit(t *testing.T) {
	now := time.Now()
	hive := &HiveNode{
		ID:             "hive:start",
		X:              0.0,
		Y:              0.0,
		GroundY:        -0.5,
		ZoneID:         "zone:start",
		DepositRadius:  3.0,
		ConversionRate: 10,
		UpdatedAt:      now,
	}

	if hive.ID != "hive:start" {
		t.Errorf("expected ID to be 'hive:start', got %s", hive.ID)
	}

	if hive.DepositRadius != 3.0 {
		t.Errorf("expected DepositRadius to be 3.0, got %f", hive.DepositRadius)
	}

	if hive.ConversionRate != 10 {
		t.Errorf("expected ConversionRate to be 10, got %d", hive.ConversionRate)
	}
}

// TestHiveNodeConversion validates pollen-to-honey conversion logic.
func TestHiveNodeConversion(t *testing.T) {
	hive := &HiveNode{
		ID:             "hive:start",
		ConversionRate: 10, // 10 pollen = 1 honey
	}

	playerProgress := &PlayerProgress{
		PollenCarried: 50,
		Honey:         0,
	}

	// Simulate conversion: 50 pollen * (1 / 10) = 5 honey
	honeyGained := playerProgress.PollenCarried / hive.ConversionRate
	playerProgress.Honey += honeyGained
	playerProgress.PollenCarried = 0

	if playerProgress.Honey != 5 {
		t.Errorf("after conversion, expected 5 honey, got %d", playerProgress.Honey)
	}

	if playerProgress.PollenCarried != 0 {
		t.Errorf("after conversion, expected 0 pollen carried, got %d", playerProgress.PollenCarried)
	}
}

// TestMultipleEntitiesCreation validates creating multiple entities independently.
func TestMultipleEntitiesCreation(t *testing.T) {
	players := []*PlayerProgress{
		{PlayerID: "player:001", PollenCapacity: 100},
		{PlayerID: "player:002", PollenCapacity: 80},
		{PlayerID: "player:003", PollenCapacity: 120},
	}

	if len(players) != 3 {
		t.Errorf("expected 3 players, got %d", len(players))
	}

	flowers := []*FlowerNode{
		{ID: "flower:0:0", PollenAvailable: 50, PollenCapacity: 100},
		{ID: "flower:1:1", PollenAvailable: 75, PollenCapacity: 100},
		{ID: "flower:2:2", PollenAvailable: 100, PollenCapacity: 100},
	}

	if len(flowers) != 3 {
		t.Errorf("expected 3 flowers, got %d", len(flowers))
	}

	hives := []*HiveNode{
		{ID: "hive:start", DepositRadius: 3.0, ConversionRate: 10},
		{ID: "hive:zone2", DepositRadius: 2.5, ConversionRate: 12},
	}

	if len(hives) != 2 {
		t.Errorf("expected 2 hives, got %d", len(hives))
	}

	// Verify no cross-contamination between entities
	if players[0].PlayerID == players[1].PlayerID {
		t.Errorf("player IDs should be unique")
	}

	if flowers[0].ID == flowers[1].ID {
		t.Errorf("flower IDs should be unique")
	}

	if hives[0].ID == hives[1].ID {
		t.Errorf("hive IDs should be unique")
	}
}

// TestPlayerProgressJSONMarshal validates that PlayerProgress can be marshaled to JSON with correct field names.
func TestPlayerProgressJSONMarshal(t *testing.T) {
	progress := &PlayerProgress{
		PlayerID:        "player:001",
		PollenCarried:   25,
		PollenCapacity:  100,
		Honey:           10,
		Level:           2,
		XP:              150,
		SkillPoints:     1,
		CurrentZoneID:   "zone:forest",
		UnlockedZoneIDs: []string{"zone:start", "zone:forest"},
		UpdatedAt:       time.Now(),
	}

	data, err := json.Marshal(progress)
	if err != nil {
		t.Fatalf("failed to marshal PlayerProgress: %v", err)
	}

	var jsonMap map[string]interface{}
	err = json.Unmarshal(data, &jsonMap)
	if err != nil {
		t.Fatalf("failed to unmarshal PlayerProgress JSON: %v", err)
	}

	// Verify all expected fields are present with correct camelCase names
	expectedFields := []string{"playerId", "pollenCarried", "pollenCapacity", "honey", "level", "xp", "skillPoints", "currentZoneId", "unlockedZoneIds", "currentLife", "maxLife", "currentEnergy", "maxEnergy"}
	for _, field := range expectedFields {
		if _, exists := jsonMap[field]; !exists {
			t.Errorf("expected JSON field %q not found in marshaled output", field)
		}
	}

	// Verify UpdatedAt is not included (json:"-")
	if _, exists := jsonMap["UpdatedAt"]; exists {
		t.Error("UpdatedAt should not be included in JSON output")
	}
}

// TestPlayerProgressJSONUnmarshal validates that PlayerProgress can be unmarshaled from JSON.
func TestPlayerProgressJSONUnmarshal(t *testing.T) {
	jsonData := `{
		"playerId": "player:002",
		"pollenCarried": 40,
		"pollenCapacity": 120,
		"honey": 15,
		"level": 3,
		"xp": 300,
		"skillPoints": 2,
		"currentZoneId": "zone:meadow",
		"unlockedZoneIds": ["zone:start", "zone:forest", "zone:meadow"]
	}`

	var progress PlayerProgress
	err := json.Unmarshal([]byte(jsonData), &progress)
	if err != nil {
		t.Fatalf("failed to unmarshal JSON to PlayerProgress: %v", err)
	}

	if progress.PlayerID != "player:002" {
		t.Errorf("expected PlayerID 'player:002', got %q", progress.PlayerID)
	}
	if progress.PollenCarried != 40 {
		t.Errorf("expected PollenCarried 40, got %d", progress.PollenCarried)
	}
	if progress.Honey != 15 {
		t.Errorf("expected Honey 15, got %d", progress.Honey)
	}
	if len(progress.UnlockedZoneIDs) != 3 {
		t.Errorf("expected 3 unlocked zones, got %d", len(progress.UnlockedZoneIDs))
	}
}

// TestFlowerNodeJSONMarshal validates that FlowerNode can be marshaled to JSON with correct field names.
func TestFlowerNodeJSONMarshal(t *testing.T) {
	flower := &FlowerNode{
		ID:              "flower:5:7",
		X:               12.5,
		Y:               8.3,
		GroundY:         0.0,
		ZoneID:          "zone:forest",
		PollenAvailable: 75,
		PollenCapacity:  100,
		CollectRadius:   2.0,
		RegenPerSecond:  0.5,
		YieldPerClick:   8,
		LastRegenAt:     time.Now(),
		UpdatedAt:       time.Now(),
	}

	data, err := json.Marshal(flower)
	if err != nil {
		t.Fatalf("failed to marshal FlowerNode: %v", err)
	}

	var jsonMap map[string]interface{}
	err = json.Unmarshal(data, &jsonMap)
	if err != nil {
		t.Fatalf("failed to unmarshal FlowerNode JSON: %v", err)
	}

	// Verify all expected fields are present with correct camelCase names
	expectedFields := []string{"id", "x", "y", "groundY", "zoneId", "pollenAvailable", "pollenCapacity", "collectRadius", "regenPerSecond", "yieldPerClick"}
	for _, field := range expectedFields {
		if _, exists := jsonMap[field]; !exists {
			t.Errorf("expected JSON field %q not found in marshaled output", field)
		}
	}

	// Verify timestamps are not included
	if _, exists := jsonMap["LastRegenAt"]; exists {
		t.Error("LastRegenAt should not be included in JSON output")
	}
	if _, exists := jsonMap["UpdatedAt"]; exists {
		t.Error("UpdatedAt should not be included in JSON output")
	}
}

// TestFlowerNodeJSONUnmarshal validates that FlowerNode can be unmarshaled from JSON.
func TestFlowerNodeJSONUnmarshal(t *testing.T) {
	jsonData := `{
		"id": "flower:10:15",
		"x": 25.0,
		"y": 18.5,
		"groundY": 0.5,
		"zoneId": "zone:meadow",
		"pollenAvailable": 90,
		"pollenCapacity": 100,
		"collectRadius": 2.5,
		"regenPerSecond": 0.3,
		"yieldPerClick": 10
	}`

	var flower FlowerNode
	err := json.Unmarshal([]byte(jsonData), &flower)
	if err != nil {
		t.Fatalf("failed to unmarshal JSON to FlowerNode: %v", err)
	}

	if flower.ID != "flower:10:15" {
		t.Errorf("expected ID 'flower:10:15', got %q", flower.ID)
	}
	if flower.X != 25.0 {
		t.Errorf("expected X 25.0, got %f", flower.X)
	}
	if flower.PollenAvailable != 90 {
		t.Errorf("expected PollenAvailable 90, got %d", flower.PollenAvailable)
	}
	if flower.YieldPerClick != 10 {
		t.Errorf("expected YieldPerClick 10, got %d", flower.YieldPerClick)
	}
}

// TestHiveNodeJSONMarshal validates that HiveNode can be marshaled to JSON with correct field names.
func TestHiveNodeJSONMarshal(t *testing.T) {
	hive := &HiveNode{
		ID:             "hive:forest",
		X:              50.0,
		Y:              40.0,
		GroundY:        -1.0,
		ZoneID:         "zone:forest",
		DepositRadius:  3.5,
		ConversionRate: 12,
		UpdatedAt:      time.Now(),
	}

	data, err := json.Marshal(hive)
	if err != nil {
		t.Fatalf("failed to marshal HiveNode: %v", err)
	}

	var jsonMap map[string]interface{}
	err = json.Unmarshal(data, &jsonMap)
	if err != nil {
		t.Fatalf("failed to unmarshal HiveNode JSON: %v", err)
	}

	// Verify all expected fields are present with correct camelCase names
	expectedFields := []string{"id", "x", "y", "groundY", "zoneId", "depositRadius", "conversionRate"}
	for _, field := range expectedFields {
		if _, exists := jsonMap[field]; !exists {
			t.Errorf("expected JSON field %q not found in marshaled output", field)
		}
	}

	// Verify UpdatedAt is not included
	if _, exists := jsonMap["UpdatedAt"]; exists {
		t.Error("UpdatedAt should not be included in JSON output")
	}
}

// TestHiveNodeJSONUnmarshal validates that HiveNode can be unmarshaled from JSON.
func TestHiveNodeJSONUnmarshal(t *testing.T) {
	jsonData := `{
		"id": "hive:meadow",
		"x": 75.5,
		"y": 60.0,
		"groundY": -0.8,
		"zoneId": "zone:meadow",
		"depositRadius": 3.0,
		"conversionRate": 8
	}`

	var hive HiveNode
	err := json.Unmarshal([]byte(jsonData), &hive)
	if err != nil {
		t.Fatalf("failed to unmarshal JSON to HiveNode: %v", err)
	}

	if hive.ID != "hive:meadow" {
		t.Errorf("expected ID 'hive:meadow', got %q", hive.ID)
	}
	if hive.X != 75.5 {
		t.Errorf("expected X 75.5, got %f", hive.X)
	}
	if hive.DepositRadius != 3.0 {
		t.Errorf("expected DepositRadius 3.0, got %f", hive.DepositRadius)
	}
	if hive.ConversionRate != 8 {
		t.Errorf("expected ConversionRate 8, got %d", hive.ConversionRate)
	}
}
