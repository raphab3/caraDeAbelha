package loopbase

import (
	"fmt"
	"testing"
	"time"
)

// TestNewLoopBaseService validates that LoopBaseService initializes with default test data.
func TestNewLoopBaseService(t *testing.T) {
	service := NewLoopBaseService()

	if service == nil {
		t.Fatal("expected NewLoopBaseService to return non-nil service")
	}

	if service.flowers == nil {
		t.Error("expected flowers map to be initialized")
	}

	if service.hives == nil {
		t.Error("expected hives map to be initialized")
	}

	// Verify zone:start is populated
	flowers := service.GetFlowersByZone("zone:start")
	if len(flowers) != 2 {
		t.Errorf("expected 2 flowers in zone:start, got %d", len(flowers))
	}

	hives := service.GetHivesByZone("zone:start")
	if len(hives) != 1 {
		t.Errorf("expected 1 hive in zone:start, got %d", len(hives))
	}
}

// TestGetFlowersByZone validates that flowers are correctly retrieved by zone.
func TestGetFlowersByZone(t *testing.T) {
	service := NewLoopBaseService()

	// Test zone:start has 2 flowers
	flowers := service.GetFlowersByZone("zone:start")
	if len(flowers) != 2 {
		t.Errorf("expected 2 flowers in zone:start, got %d", len(flowers))
	}

	// Verify flower properties
	if flowers[0].ID != "flower:start:1" {
		t.Errorf("expected first flower ID to be 'flower:start:1', got %s", flowers[0].ID)
	}

	if flowers[0].PollenAvailable != 100 {
		t.Errorf("expected first flower pollen to be 100, got %d", flowers[0].PollenAvailable)
	}

	// Test non-existent zone returns empty slice
	emptyFlowers := service.GetFlowersByZone("zone:nonexistent")
	if len(emptyFlowers) != 0 {
		t.Errorf("expected empty slice for non-existent zone, got %d flowers", len(emptyFlowers))
	}
}

// TestGetHivesByZone validates that hives are correctly retrieved by zone.
func TestGetHivesByZone(t *testing.T) {
	service := NewLoopBaseService()

	// Test zone:start has 1 hive
	hives := service.GetHivesByZone("zone:start")
	if len(hives) != 1 {
		t.Errorf("expected 1 hive in zone:start, got %d", len(hives))
	}

	// Verify hive properties
	if hives[0].ID != "hive:start" {
		t.Errorf("expected hive ID to be 'hive:start', got %s", hives[0].ID)
	}

	if hives[0].DepositRadius != 3.0 {
		t.Errorf("expected hive deposit radius to be 3.0, got %f", hives[0].DepositRadius)
	}

	if hives[0].ConversionRate != 10 {
		t.Errorf("expected hive conversion rate to be 10, got %d", hives[0].ConversionRate)
	}

	// Test non-existent zone returns empty slice
	emptyHives := service.GetHivesByZone("zone:nonexistent")
	if len(emptyHives) != 0 {
		t.Errorf("expected empty slice for non-existent zone, got %d hives", len(emptyHives))
	}
}

// TestIsPlayerInFlowerRange validates distance calculation for flower collection.
func TestIsPlayerInFlowerRange(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")

	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // flower at (5.0, 5.0) with collectRadius 2.5

	tests := []struct {
		name     string
		playerX  float64
		playerY  float64
		expected bool
	}{
		{
			name:     "player at flower center",
			playerX:  5.0,
			playerY:  5.0,
			expected: true,
		},
		{
			name:     "player at collection radius boundary",
			playerX:  5.0 + 2.5,
			playerY:  5.0,
			expected: true,
		},
		{
			name:     "player just inside collection radius",
			playerX:  6.0,
			playerY:  5.0,
			expected: true,
		},
		{
			name:     "player just outside collection radius",
			playerX:  8.0,
			playerY:  5.0,
			expected: false,
		},
		{
			name:     "player far away",
			playerX:  100.0,
			playerY:  100.0,
			expected: false,
		},
		{
			name:     "player at diagonal within radius",
			playerX:  5.0 + 1.5,
			playerY:  5.0 + 1.5,
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.IsPlayerInFlowerRange(tt.playerX, tt.playerY, flower)
			if result != tt.expected {
				t.Errorf("expected %v, got %v for player at (%.2f, %.2f)", tt.expected, result, tt.playerX, tt.playerY)
			}
		})
	}
}

// TestIsPlayerInHiveRange validates distance calculation for hive deposit.
func TestIsPlayerInHiveRange(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0] // hive at (0.0, 0.0) with depositRadius 3.0

	tests := []struct {
		name     string
		playerX  float64
		playerY  float64
		expected bool
	}{
		{
			name:     "player at hive center",
			playerX:  0.0,
			playerY:  0.0,
			expected: true,
		},
		{
			name:     "player at deposit radius boundary",
			playerX:  3.0,
			playerY:  0.0,
			expected: true,
		},
		{
			name:     "player just inside deposit radius",
			playerX:  2.0,
			playerY:  0.0,
			expected: true,
		},
		{
			name:     "player just outside deposit radius",
			playerX:  3.5,
			playerY:  0.0,
			expected: false,
		},
		{
			name:     "player far away",
			playerX:  50.0,
			playerY:  50.0,
			expected: false,
		},
		{
			name:     "player at diagonal within radius",
			playerX:  2.0,
			playerY:  2.0,
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.IsPlayerInHiveRange(tt.playerX, tt.playerY, hive)
			if result != tt.expected {
				t.Errorf("expected %v, got %v for player at (%.2f, %.2f)", tt.expected, result, tt.playerX, tt.playerY)
			}
		})
	}
}

// TestNilFlowerRange validates that nil flower returns false.
func TestNilFlowerRange(t *testing.T) {
	service := NewLoopBaseService()
	result := service.IsPlayerInFlowerRange(5.0, 5.0, nil)

	if result {
		t.Error("expected IsPlayerInFlowerRange to return false for nil flower")
	}
}

// TestNilHiveRange validates that nil hive returns false.
func TestNilHiveRange(t *testing.T) {
	service := NewLoopBaseService()
	result := service.IsPlayerInHiveRange(0.0, 0.0, nil)

	if result {
		t.Error("expected IsPlayerInHiveRange to return false for nil hive")
	}
}

// TestAddFlowerToZone validates that flowers can be dynamically added to zones.
func TestAddFlowerToZone(t *testing.T) {
	service := NewLoopBaseService()

	newFlower := &FlowerNode{
		ID:             "flower:test:new",
		X:              15.0,
		Y:              15.0,
		GroundY:        0.0,
		ZoneID:         "zone:test",
		PollenAvailable: 50,
		PollenCapacity: 50,
		CollectRadius:  2.0,
		RegenPerSecond: 0.05,
		YieldPerClick:  3,
	}

	err := service.AddFlowerToZone("zone:test", newFlower)
	if err != nil {
		t.Fatalf("unexpected error adding flower: %v", err)
	}

	flowers := service.GetFlowersByZone("zone:test")
	if len(flowers) != 1 {
		t.Errorf("expected 1 flower in zone:test, got %d", len(flowers))
	}

	if flowers[0].ID != "flower:test:new" {
		t.Errorf("expected flower ID 'flower:test:new', got %s", flowers[0].ID)
	}
}

// TestAddFlowerToZoneNil validates error handling for nil flower.
func TestAddFlowerToZoneNil(t *testing.T) {
	service := NewLoopBaseService()
	err := service.AddFlowerToZone("zone:test", nil)

	if err == nil {
		t.Error("expected error when adding nil flower")
	}
}

// TestAddFlowerToZoneEmptyZone validates error handling for empty zone ID.
func TestAddFlowerToZoneEmptyZone(t *testing.T) {
	service := NewLoopBaseService()
	flower := &FlowerNode{ID: "flower:test"}

	err := service.AddFlowerToZone("", flower)
	if err == nil {
		t.Error("expected error when adding flower to empty zone ID")
	}
}

// TestAddHiveToZone validates that hives can be dynamically added to zones.
func TestAddHiveToZone(t *testing.T) {
	service := NewLoopBaseService()

	newHive := &HiveNode{
		ID:             "hive:test:new",
		X:              20.0,
		Y:              20.0,
		GroundY:        -0.5,
		ZoneID:         "zone:test",
		DepositRadius:  2.5,
		ConversionRate: 8,
	}

	err := service.AddHiveToZone("zone:test", newHive)
	if err != nil {
		t.Fatalf("unexpected error adding hive: %v", err)
	}

	hives := service.GetHivesByZone("zone:test")
	if len(hives) != 1 {
		t.Errorf("expected 1 hive in zone:test, got %d", len(hives))
	}

	if hives[0].ID != "hive:test:new" {
		t.Errorf("expected hive ID 'hive:test:new', got %s", hives[0].ID)
	}
}

// TestAddHiveToZoneNil validates error handling for nil hive.
func TestAddHiveToZoneNil(t *testing.T) {
	service := NewLoopBaseService()
	err := service.AddHiveToZone("zone:test", nil)

	if err == nil {
		t.Error("expected error when adding nil hive")
	}
}

// TestAddHiveToZoneEmptyZone validates error handling for empty zone ID.
func TestAddHiveToZoneEmptyZone(t *testing.T) {
	service := NewLoopBaseService()
	hive := &HiveNode{ID: "hive:test"}

	err := service.AddHiveToZone("", hive)
	if err == nil {
		t.Error("expected error when adding hive to empty zone ID")
	}
}

// TestMultipleZones validates that service correctly manages multiple zones independently.
func TestMultipleZones(t *testing.T) {
	service := NewLoopBaseService()

	// Add entities to zone:2
	flower2 := &FlowerNode{
		ID:              "flower:zone2:1",
		X:               30.0,
		Y:               30.0,
		ZoneID:          "zone:2",
		PollenAvailable: 75,
		PollenCapacity: 75,
		CollectRadius:  2.0,
	}

	hive2 := &HiveNode{
		ID:            "hive:zone2",
		X:             25.0,
		Y:             25.0,
		ZoneID:        "zone:2",
		DepositRadius: 2.8,
		ConversionRate: 12,
	}

	service.AddFlowerToZone("zone:2", flower2)
	service.AddHiveToZone("zone:2", hive2)

	// Verify zone:start still has original entities
	flowers1 := service.GetFlowersByZone("zone:start")
	if len(flowers1) != 2 {
		t.Errorf("zone:start should have 2 flowers, got %d", len(flowers1))
	}

	// Verify zone:2 has new entities
	flowers2 := service.GetFlowersByZone("zone:2")
	if len(flowers2) != 1 {
		t.Errorf("zone:2 should have 1 flower, got %d", len(flowers2))
	}

	hives2 := service.GetHivesByZone("zone:2")
	if len(hives2) != 1 {
		t.Errorf("zone:2 should have 1 hive, got %d", len(hives2))
	}

	// Verify isolation: zone:2 flower should not be found in zone:start query
	for _, f := range flowers1 {
		if f.ID == "flower:zone2:1" {
			t.Error("zone:2 flower should not be in zone:start query")
		}
	}
}

// TestFlowerWithInitialPollenEqualCapacity validates default flower state.
func TestFlowerWithInitialPollenEqualCapacity(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")

	for _, flower := range flowers {
		if flower.PollenAvailable != flower.PollenCapacity {
			t.Errorf("flower %s: expected pollen (%d) to equal capacity (%d)", 
				flower.ID, flower.PollenAvailable, flower.PollenCapacity)
		}
	}
}

// TestFlowerCollectRadiusValidation validates that collect radius is properly set.
func TestFlowerCollectRadiusValidation(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")

	for _, flower := range flowers {
		if flower.CollectRadius <= 0 {
			t.Errorf("flower %s: collect radius should be positive, got %f", flower.ID, flower.CollectRadius)
		}

		if flower.CollectRadius != 2.5 {
			t.Errorf("flower %s: expected collect radius 2.5, got %f", flower.ID, flower.CollectRadius)
		}
	}
}

// TestHiveDepositRadiusValidation validates that deposit radius is properly set.
func TestHiveDepositRadiusValidation(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	for _, hive := range hives {
		if hive.DepositRadius <= 0 {
			t.Errorf("hive %s: deposit radius should be positive, got %f", hive.ID, hive.DepositRadius)
		}

		if hive.DepositRadius != 3.0 {
			t.Errorf("hive %s: expected deposit radius 3.0, got %f", hive.ID, hive.DepositRadius)
		}
	}
}

// TestDistanceCalculationAccuracy validates that distance calculation is accurate.
func TestDistanceCalculationAccuracy(t *testing.T) {
	tests := []struct {
		name      string
		x1        float64
		y1        float64
		x2        float64
		y2        float64
		expected  float64
		tolerance float64
	}{
		{
			name:      "distance 0 at same point",
			x1:        0, y1: 0,
			x2:        0, y2: 0,
			expected:  0,
			tolerance: 0.0001,
		},
		{
			name:      "distance 3 for 3-4-5 triangle",
			x1:        0, y1: 0,
			x2:        3, y2: 4,
			expected:  5,
			tolerance: 0.0001,
		},
		{
			name:      "distance sqrt(2) for unit diagonal",
			x1:        0, y1: 0,
			x2:        1, y2: 1,
			expected:  1.41421356,
			tolerance: 0.0001,
		},
		{
			name:      "distance works with negative coordinates",
			x1:        -5, y1: -5,
			x2:        5, y2: 5,
			expected:  14.14213562,
			tolerance: 0.0001,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flower := &FlowerNode{X: tt.x2, Y: tt.y2, CollectRadius: 100} // Large radius to not affect test
			service := NewLoopBaseService()
			
			// Use service distance validator by setting appropriate radius
			flower.CollectRadius = tt.expected + 0.001 // Just over the expected distance
			if !service.IsPlayerInFlowerRange(tt.x1, tt.y1, flower) {
				t.Errorf("player should be in range at exact distance threshold")
			}

			flower.CollectRadius = tt.expected - 0.001 // Just under the expected distance
			if service.IsPlayerInFlowerRange(tt.x1, tt.y1, flower) {
				t.Errorf("player should not be in range just outside distance threshold")
			}
		})
	}
}

// TestFlowerTimestamps validates that flowers have proper timestamp fields.
func TestFlowerTimestamps(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")

	for _, flower := range flowers {
		// Verify LastRegenAt is set (should be zero or recent)
		// UpdatedAt should exist as a field
		if flower.UpdatedAt.IsZero() && flower.LastRegenAt.IsZero() {
			// Both can be zero for newly created flowers
			t.Logf("flower %s: timestamps initialized as zero", flower.ID)
		}
	}
}

// TestServiceConcurrentAccess validates that service handles concurrent reads safely.
func TestServiceConcurrentAccess(t *testing.T) {
	service := NewLoopBaseService()

	// Launch multiple goroutines reading from service
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func() {
			flowers := service.GetFlowersByZone("zone:start")
			hives := service.GetHivesByZone("zone:start")
			if len(flowers) > 0 && len(hives) > 0 {
				service.IsPlayerInFlowerRange(5.0, 5.0, flowers[0])
				service.IsPlayerInHiveRange(0.0, 0.0, hives[0])
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestZoneStartInitialState validates the exact initial state of zone:start.
func TestZoneStartInitialState(t *testing.T) {
	service := NewLoopBaseService()

	// Check flowers in zone:start
	flowers := service.GetFlowersByZone("zone:start")
	expectedFlowerCount := 2
	if len(flowers) != expectedFlowerCount {
		t.Fatalf("expected %d flowers in zone:start, got %d", expectedFlowerCount, len(flowers))
	}

	// Verify first flower
	if flowers[0].ID != "flower:start:1" || flowers[0].X != 5.0 || flowers[0].Y != 5.0 {
		t.Error("first flower has unexpected properties")
	}

	// Verify second flower
	if flowers[1].ID != "flower:start:2" || flowers[1].X != 10.0 || flowers[1].Y != 8.0 {
		t.Error("second flower has unexpected properties")
	}

	// Check hives in zone:start
	hives := service.GetHivesByZone("zone:start")
	expectedHiveCount := 1
	if len(hives) != expectedHiveCount {
		t.Fatalf("expected %d hive in zone:start, got %d", expectedHiveCount, len(hives))
	}

	// Verify hive
	if hives[0].ID != "hive:start" || hives[0].X != 0.0 || hives[0].Y != 0.0 {
		t.Error("hive has unexpected properties")
	}
}

// TestCanCollectFlowerSuccessful validates successful collection preconditions.
func TestCanCollectFlowerSuccessful(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // flower at (5.0, 5.0)
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	// Player at flower location with capacity
	canCollect, reason := service.CanCollectFlower(playerProgress, flower, 5.0, 5.0)

	if !canCollect {
		t.Errorf("expected CanCollectFlower to return true, got false: %s", reason)
	}

	if reason != "" {
		t.Errorf("expected empty reason for successful validation, got: %s", reason)
	}
}

// TestCanCollectFlowerOutOfRange validates that out-of-range players cannot collect.
func TestCanCollectFlowerOutOfRange(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // flower at (5.0, 5.0) with collectRadius 2.5
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	// Player far away (outside 2.5 radius)
	canCollect, reason := service.CanCollectFlower(playerProgress, flower, 100.0, 100.0)

	if canCollect {
		t.Error("expected CanCollectFlower to return false for out-of-range player")
	}

	if reason != "player is out of range" {
		t.Errorf("expected 'player is out of range' reason, got: %s", reason)
	}
}

// TestCanCollectFlowerNoPollen validates that depleted flowers cannot be collected.
func TestCanCollectFlowerNoPollen(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0]
	flower.PollenAvailable = 0 // Deplete flower
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	canCollect, reason := service.CanCollectFlower(playerProgress, flower, 5.0, 5.0)

	if canCollect {
		t.Error("expected CanCollectFlower to return false for depleted flower")
	}

	if reason != "flower has no pollen available" {
		t.Errorf("expected 'flower has no pollen available' reason, got: %s", reason)
	}
}

// TestCanCollectFlowerMochilaFull validates that full mochila blocks collection.
func TestCanCollectFlowerMochilaFull(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0]
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 50, // Mochila is full
	}

	canCollect, reason := service.CanCollectFlower(playerProgress, flower, 5.0, 5.0)

	if canCollect {
		t.Error("expected CanCollectFlower to return false for full mochila")
	}

	if reason != "mochila is full" {
		t.Errorf("expected 'mochila is full' reason, got: %s", reason)
	}
}

// TestCanCollectFlowerNilPlayer validates that nil player returns error.
func TestCanCollectFlowerNilPlayer(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0]
	
	canCollect, reason := service.CanCollectFlower(nil, flower, 5.0, 5.0)

	if canCollect {
		t.Error("expected CanCollectFlower to return false for nil player")
	}

	if reason != "player progress is nil" {
		t.Errorf("expected 'player progress is nil' reason, got: %s", reason)
	}
}

// TestCanCollectFlowerNilFlower validates that nil flower returns error.
func TestCanCollectFlowerNilFlower(t *testing.T) {
	service := NewLoopBaseService()
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	canCollect, reason := service.CanCollectFlower(playerProgress, nil, 5.0, 5.0)

	if canCollect {
		t.Error("expected CanCollectFlower to return false for nil flower")
	}

	if reason != "flower is nil" {
		t.Errorf("expected 'flower is nil' reason, got: %s", reason)
	}
}

// TestCollectFlowerPollenSuccessful validates successful pollen collection.
func TestCollectFlowerPollenSuccessful(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // flower at (5.0, 5.0) with YieldPerClick: 5
	initialPollenAvailable := flower.PollenAvailable
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)

	if err != nil {
		t.Fatalf("unexpected error collecting pollen: %v", err)
	}

	expectedPollen := flower.YieldPerClick
	if pollenCollected != expectedPollen {
		t.Errorf("expected %d pollen collected, got %d", expectedPollen, pollenCollected)
	}

	if playerProgress.PollenCarried != expectedPollen {
		t.Errorf("expected player pollen to be %d, got %d", expectedPollen, playerProgress.PollenCarried)
	}

	expectedFlowerPollen := initialPollenAvailable - expectedPollen
	if flower.PollenAvailable != expectedFlowerPollen {
		t.Errorf("expected flower pollen to be %d, got %d", expectedFlowerPollen, flower.PollenAvailable)
	}
}

// TestCollectFlowerPollenOutOfRange validates that out-of-range collection fails.
func TestCollectFlowerPollenOutOfRange(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0]
	initialPollenAvailable := flower.PollenAvailable
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 100.0, 100.0)

	if err == nil {
		t.Error("expected error when collecting out of range")
	}

	if pollenCollected != 0 {
		t.Errorf("expected 0 pollen collected, got %d", pollenCollected)
	}

	// State should not change
	if playerProgress.PollenCarried != 0 {
		t.Errorf("expected player pollen to remain 0, got %d", playerProgress.PollenCarried)
	}

	if flower.PollenAvailable != initialPollenAvailable {
		t.Errorf("expected flower pollen to remain %d, got %d", initialPollenAvailable, flower.PollenAvailable)
	}
}

// TestCollectFlowerPollenMochilaFull validates collection when mochila is full.
func TestCollectFlowerPollenMochilaFull(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // YieldPerClick: 5
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 50, // Mochila is full
	}

	pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)

	if err == nil {
		t.Error("expected error when mochila is full")
	}

	if pollenCollected != 0 {
		t.Errorf("expected 0 pollen collected, got %d", pollenCollected)
	}
}

// TestCollectFlowerPollenPartialCapacity validates collection when mochila has partial capacity.
func TestCollectFlowerPollenPartialCapacity(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // YieldPerClick: 5
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  48,
		PollenCapacity: 50, // Only 2 units capacity left
	}

	pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)

	if err != nil {
		t.Fatalf("unexpected error collecting pollen: %v", err)
	}

	// Should only collect what fits (2 units, not full 5)
	expectedPollen := 2
	if pollenCollected != expectedPollen {
		t.Errorf("expected %d pollen collected (limited by capacity), got %d", expectedPollen, pollenCollected)
	}

	// Player should now be at capacity
	expectedPlayerPollen := 50 // 48 + 2 = 50
	if playerProgress.PollenCarried != expectedPlayerPollen {
		t.Errorf("expected player pollen to be %d, got %d", expectedPlayerPollen, playerProgress.PollenCarried)
	}
}

// TestCollectFlowerPollenFlowerPartiallyDepleted validates collection from partially depleted flower.
func TestCollectFlowerPollenFlowerPartiallyDepleted(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // YieldPerClick: 5
	flower.PollenAvailable = 2 // Only 2 pollen left
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)

	if err != nil {
		t.Fatalf("unexpected error collecting pollen: %v", err)
	}

	// Should collect what's available (2), not full yield (5)
	expectedPollen := 2
	if pollenCollected != expectedPollen {
		t.Errorf("expected %d pollen collected (flower limited), got %d", expectedPollen, pollenCollected)
	}

	if playerProgress.PollenCarried != expectedPollen {
		t.Errorf("expected player pollen to be %d, got %d", expectedPollen, playerProgress.PollenCarried)
	}

	if flower.PollenAvailable != 0 {
		t.Errorf("expected flower pollen to be 0, got %d", flower.PollenAvailable)
	}
}

// TestCollectFlowerPollenNegativeFloorCheck validates that flower pollen never goes negative.
func TestCollectFlowerPollenNegativeFloorCheck(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0]
	flower.PollenAvailable = 3 // Less than YieldPerClick (5)
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	_, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)

	if err != nil {
		t.Fatalf("unexpected error collecting pollen: %v", err)
	}

	if flower.PollenAvailable < 0 {
		t.Errorf("flower pollen went negative: %d", flower.PollenAvailable)
	}

	if flower.PollenAvailable != 0 {
		t.Errorf("expected flower pollen to be 0, got %d", flower.PollenAvailable)
	}
}

// TestCollectFlowerPollenMultipleTimes validates multiple sequential collections.
func TestCollectFlowerPollenMultipleTimes(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // YieldPerClick: 5, Initial: 100
	initialFlowerPollen := flower.PollenAvailable
	
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 50,
	}

	// Collect 3 times
	for i := 0; i < 3; i++ {
		pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)

		if err != nil {
			t.Fatalf("iteration %d: unexpected error collecting pollen: %v", i, err)
		}

		expectedPollen := 5
		if pollenCollected != expectedPollen {
			t.Errorf("iteration %d: expected %d pollen collected, got %d", i, expectedPollen, pollenCollected)
		}
	}

	expectedPlayerTotal := 15 // 3 collections * 5 pollen each
	if playerProgress.PollenCarried != expectedPlayerTotal {
		t.Errorf("expected player total pollen to be %d, got %d", expectedPlayerTotal, playerProgress.PollenCarried)
	}

	expectedFlowerRemaining := initialFlowerPollen - expectedPlayerTotal
	if flower.PollenAvailable != expectedFlowerRemaining {
		t.Errorf("expected flower pollen to be %d, got %d", expectedFlowerRemaining, flower.PollenAvailable)
	}
}

// TestCollectFlowerPollenConcurrentCollections validates thread-safe concurrent collections.
func TestCollectFlowerPollenConcurrentCollections(t *testing.T) {
	service := NewLoopBaseService()
	flowers := service.GetFlowersByZone("zone:start")
	
	if len(flowers) == 0 {
		t.Fatal("expected at least one flower in zone:start")
	}

	flower := flowers[0] // YieldPerClick: 5
	initialFlowerPollen := flower.PollenAvailable
	
	// Create 5 concurrent players
	done := make(chan bool, 5)
	totalCollected := 0

	for i := 0; i < 5; i++ {
		go func(playerID int) {
			playerProgress := &PlayerProgress{
				PlayerID:       fmt.Sprintf("player:test:%d", playerID),
				PollenCarried:  0,
				PollenCapacity: 50,
			}

			pollenCollected, err := service.CollectFlowerPollen(playerProgress, flower, 5.0, 5.0)
			
			if err == nil && pollenCollected > 0 {
				totalCollected += pollenCollected
			}
			
			done <- true
		}(i)
	}

	// Wait for all goroutines to finish
	for i := 0; i < 5; i++ {
		<-done
	}

	// Note: Due to concurrency, individual collections might be limited
	// Verify that flower pollen was reduced
	if flower.PollenAvailable >= initialFlowerPollen {
		t.Error("expected flower pollen to be reduced after concurrent collections")
	}

	if flower.PollenAvailable < 0 {
		t.Errorf("flower pollen went negative: %d", flower.PollenAvailable)
	}
}

// TestCanDepositAtHiveSuccessful validates successful deposit preconditions.
func TestCanDepositAtHiveSuccessful(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 100,
		Honey:          0,
	}

	canDeposit, reason := service.CanDepositAtHive(playerProgress, hive)

	if !canDeposit {
		t.Errorf("expected CanDepositAtHive to return true, got false: %s", reason)
	}

	if reason != "" {
		t.Errorf("expected empty reason for successful validation, got: %s", reason)
	}
}

// TestCanDepositAtHiveNoPollen validates that players with zero pollen cannot deposit.
func TestCanDepositAtHiveNoPollen(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 100,
		Honey:          0,
	}

	canDeposit, reason := service.CanDepositAtHive(playerProgress, hive)

	if canDeposit {
		t.Error("expected CanDepositAtHive to return false for player with zero pollen")
	}

	if reason != "player has no pollen to deposit" {
		t.Errorf("expected 'player has no pollen to deposit' reason, got: %s", reason)
	}
}

// TestCanDepositAtHiveNegativePollen validates that negative pollen is treated as none.
func TestCanDepositAtHiveNegativePollen(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  -5,
		PollenCapacity: 100,
		Honey:          0,
	}

	canDeposit, reason := service.CanDepositAtHive(playerProgress, hive)

	if canDeposit {
		t.Error("expected CanDepositAtHive to return false for negative pollen")
	}

	if reason != "player has no pollen to deposit" {
		t.Errorf("expected 'player has no pollen to deposit' reason, got: %s", reason)
	}
}

// TestCanDepositAtHiveNilPlayer validates that nil player returns error.
func TestCanDepositAtHiveNilPlayer(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]

	canDeposit, reason := service.CanDepositAtHive(nil, hive)

	if canDeposit {
		t.Error("expected CanDepositAtHive to return false for nil player")
	}

	if reason != "player progress is nil" {
		t.Errorf("expected 'player progress is nil' reason, got: %s", reason)
	}
}

// TestCanDepositAtHiveNilHive validates that nil hive returns error.
func TestCanDepositAtHiveNilHive(t *testing.T) {
	service := NewLoopBaseService()
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 100,
		Honey:          0,
	}

	canDeposit, reason := service.CanDepositAtHive(playerProgress, nil)

	if canDeposit {
		t.Error("expected CanDepositAtHive to return false for nil hive")
	}

	if reason != "hive is nil" {
		t.Errorf("expected 'hive is nil' reason, got: %s", reason)
	}
}

// TestDepositPollenToHoneySuccessfulFullLoad validates successful deposit with full pollen load.
func TestDepositPollenToHoneySuccessfulFullLoad(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0] // ConversionRate = 10
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  100,
		PollenCapacity: 100,
		Honey:          0,
	}

	// 100 pollen ÷ 10 rate = 10 honey
	honeyGained, err := service.DepositPollenToHoney(playerProgress, hive)

	if err != nil {
		t.Errorf("unexpected error during deposit: %v", err)
	}

	if honeyGained != 10 {
		t.Errorf("expected 10 honey gained, got %d", honeyGained)
	}

	if playerProgress.Honey != 10 {
		t.Errorf("expected player honey to be 10, got %d", playerProgress.Honey)
	}

	if playerProgress.PollenCarried != 0 {
		t.Errorf("expected player pollen to be 0 after deposit, got %d", playerProgress.PollenCarried)
	}

	if hive.UpdatedAt.IsZero() {
		t.Error("expected hive UpdatedAt to be set")
	}

	if playerProgress.UpdatedAt.IsZero() {
		t.Error("expected player UpdatedAt to be set")
	}
}

// TestDepositPollenToHoneyPartialLoad validates deposit with partial pollen load.
func TestDepositPollenToHoneyPartialLoad(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0] // ConversionRate = 10
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 100,
		Honey:          5,
	}

	// 50 pollen ÷ 10 rate = 5 honey
	honeyGained, err := service.DepositPollenToHoney(playerProgress, hive)

	if err != nil {
		t.Errorf("unexpected error during deposit: %v", err)
	}

	if honeyGained != 5 {
		t.Errorf("expected 5 honey gained, got %d", honeyGained)
	}

	if playerProgress.Honey != 10 { // 5 previous + 5 gained
		t.Errorf("expected player honey to be 10, got %d", playerProgress.Honey)
	}

	if playerProgress.PollenCarried != 0 {
		t.Errorf("expected player pollen to be 0 after deposit, got %d", playerProgress.PollenCarried)
	}
}

// TestDepositPollenToHoneyWithDifferentRates validates deposit with different conversion rates.
func TestDepositPollenToHoneyWithDifferentRates(t *testing.T) {
	tests := []struct {
		name            string
		pollenCarried   int
		conversionRate  int
		expectedHoney   int
		expectedPollen  int
	}{
		{
			name:           "10:1 ratio with 100 pollen",
			pollenCarried:  100,
			conversionRate: 10,
			expectedHoney:  10,
			expectedPollen: 0,
		},
		{
			name:           "8:1 ratio with 80 pollen",
			pollenCarried:  80,
			conversionRate: 8,
			expectedHoney:  10,
			expectedPollen: 0,
		},
		{
			name:           "12:1 ratio with 120 pollen",
			pollenCarried:  120,
			conversionRate: 12,
			expectedHoney:  10,
			expectedPollen: 0,
		},
		{
			name:           "5:1 ratio with 25 pollen",
			pollenCarried:  25,
			conversionRate: 5,
			expectedHoney:  5,
			expectedPollen: 0,
		},
		{
			name:           "high rate loses precision (7 pollen ÷ 10 = 0 honey)",
			pollenCarried:  7,
			conversionRate: 10,
			expectedHoney:  0,
			expectedPollen: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewLoopBaseService()

			hive := &HiveNode{
				ID:             "hive:test",
				X:              0.0,
				Y:              0.0,
				GroundY:        -0.5,
				ZoneID:         "zone:test",
				DepositRadius:  3.0,
				ConversionRate: tt.conversionRate,
			}

			playerProgress := &PlayerProgress{
				PlayerID:       "player:test:1",
				PollenCarried:  tt.pollenCarried,
				PollenCapacity: 200,
				Honey:          0,
			}

			honeyGained, err := service.DepositPollenToHoney(playerProgress, hive)

			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}

			if honeyGained != tt.expectedHoney {
				t.Errorf("expected %d honey, got %d", tt.expectedHoney, honeyGained)
			}

			if playerProgress.Honey != tt.expectedHoney {
				t.Errorf("expected player honey %d, got %d", tt.expectedHoney, playerProgress.Honey)
			}

			if playerProgress.PollenCarried != tt.expectedPollen {
				t.Errorf("expected player pollen %d, got %d", tt.expectedPollen, playerProgress.PollenCarried)
			}
		})
	}
}

// TestDepositPollenToHoneyZeroPollen validates that zero pollen deposit fails.
func TestDepositPollenToHoneyZeroPollen(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  0,
		PollenCapacity: 100,
		Honey:          0,
	}

	honeyGained, err := service.DepositPollenToHoney(playerProgress, hive)

	if err == nil {
		t.Error("expected error when depositing zero pollen")
	}

	if honeyGained != 0 {
		t.Errorf("expected 0 honey gained, got %d", honeyGained)
	}

	if playerProgress.Honey != 0 {
		t.Errorf("expected honey to remain 0, got %d", playerProgress.Honey)
	}

	if playerProgress.PollenCarried != 0 {
		t.Errorf("expected pollen to remain 0, got %d", playerProgress.PollenCarried)
	}
}

// TestDepositPollenToHoneyNilInputs validates error handling for nil inputs.
func TestDepositPollenToHoneyNilInputs(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]

	tests := []struct {
		name             string
		playerProgress   *PlayerProgress
		hive             *HiveNode
		expectedErrorMsg string
	}{
		{
			name:             "nil player progress",
			playerProgress:   nil,
			hive:             hive,
			expectedErrorMsg: "player progress is nil",
		},
		{
			name:             "nil hive",
			playerProgress:   &PlayerProgress{PollenCarried: 50},
			hive:             nil,
			expectedErrorMsg: "hive is nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			honeyGained, err := service.DepositPollenToHoney(tt.playerProgress, tt.hive)

			if err == nil {
				t.Error("expected error for nil input")
			}

			if !containsString(err.Error(), tt.expectedErrorMsg) {
				t.Errorf("expected error containing '%s', got: %v", tt.expectedErrorMsg, err)
			}

			if honeyGained != 0 {
				t.Errorf("expected 0 honey from failed deposit, got %d", honeyGained)
			}
		})
	}
}

// TestDepositPollenToHoneyTimestampUpdate validates that timestamps are properly updated.
func TestDepositPollenToHoneyTimestampUpdate(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]
	oldHiveTime := hive.UpdatedAt

	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 100,
		Honey:          0,
		UpdatedAt:      time.Time{}, // Zero time
	}

	honeyGained, err := service.DepositPollenToHoney(playerProgress, hive)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if honeyGained == 0 {
		t.Error("expected honey to be gained")
	}

	// Verify timestamps were updated
	if playerProgress.UpdatedAt.IsZero() {
		t.Error("expected player UpdatedAt to be set")
	}

	if hive.UpdatedAt.IsZero() {
		t.Error("expected hive UpdatedAt to be set")
	}

	// Verify hive timestamp changed
	if hive.UpdatedAt.Equal(oldHiveTime) && !oldHiveTime.IsZero() {
		t.Error("expected hive UpdatedAt to be updated")
	}
}

// TestDepositPollenToHoneyMultiplePlayers validates concurrent deposits by multiple players.
func TestDepositPollenToHoneyMultiplePlayers(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]

	// Create multiple players with pollen
	players := make([]*PlayerProgress, 5)
	for i := 0; i < 5; i++ {
		players[i] = &PlayerProgress{
			PlayerID:       fmt.Sprintf("player:test:%d", i),
			PollenCarried:  100,
			PollenCapacity: 100,
			Honey:          0,
		}
	}

	// Simulate concurrent deposits
	done := make(chan bool, 5)

	for i := 0; i < 5; i++ {
		go func(idx int) {
			honeyGained, err := service.DepositPollenToHoney(players[idx], hive)
			if err != nil {
				t.Errorf("unexpected error for player %d: %v", idx, err)
			}
			// Note: We can't safely accumulate totalHoneyGained due to race condition
			// Instead we verify each player individually
			if honeyGained != 10 {
				t.Errorf("player %d expected 10 honey, got %d", idx, honeyGained)
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 5; i++ {
		<-done
	}

	// Verify each player has correct state
	for i, player := range players {
		if player.Honey != 10 {
			t.Errorf("player %d expected honey 10, got %d", i, player.Honey)
		}

		if player.PollenCarried != 0 {
			t.Errorf("player %d expected pollen 0, got %d", i, player.PollenCarried)
		}
	}

	// Verify hive timestamp was updated
	if hive.UpdatedAt.IsZero() {
		t.Error("expected hive UpdatedAt to be set after deposits")
	}
}

// TestDepositPreservesExistingHoney validates that existing honey is preserved during deposit.
func TestDepositPreservesExistingHoney(t *testing.T) {
	service := NewLoopBaseService()
	hives := service.GetHivesByZone("zone:start")

	if len(hives) == 0 {
		t.Fatal("expected at least one hive in zone:start")
	}

	hive := hives[0]
	playerProgress := &PlayerProgress{
		PlayerID:       "player:test:1",
		PollenCarried:  50,
		PollenCapacity: 100,
		Honey:          42, // Player already has honey
	}

	honeyGained, err := service.DepositPollenToHoney(playerProgress, hive)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// 50 pollen ÷ 10 rate = 5 honey gained
	if honeyGained != 5 {
		t.Errorf("expected 5 honey gained, got %d", honeyGained)
	}

	// 42 existing + 5 gained = 47 total
	if playerProgress.Honey != 47 {
		t.Errorf("expected 47 total honey (42 + 5), got %d", playerProgress.Honey)
	}

	if playerProgress.PollenCarried != 0 {
		t.Errorf("expected pollen cleared to 0, got %d", playerProgress.PollenCarried)
	}
}

// containsString is a helper function to check if a string contains a substring.
func containsString(haystack, needle string) bool {
	return len(haystack) > 0 && len(needle) > 0 && haystack == needle || (len(haystack) > 0 && len(needle) > 0 && contains(haystack, needle))
}

// Simple contains check
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
