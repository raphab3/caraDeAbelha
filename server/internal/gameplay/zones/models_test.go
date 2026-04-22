package zones

import (
	"testing"
	"time"
)

// TestZoneStateCreation validates that ZoneState can be created with NewZoneState factory.
func TestZoneStateCreation(t *testing.T) {
	zone := NewZoneState("zone_1", "Test Zone", 50, []string{"zone_0"}, 0, 100, 0, 100)

	if zone.ID != "zone_1" {
		t.Errorf("expected ID 'zone_1', got %q", zone.ID)
	}

	if zone.Name != "Test Zone" {
		t.Errorf("expected Name 'Test Zone', got %q", zone.Name)
	}

	if zone.CostHoney != 50 {
		t.Errorf("expected CostHoney 50, got %d", zone.CostHoney)
	}

	if len(zone.Prerequisites) != 1 || zone.Prerequisites[0] != "zone_0" {
		t.Errorf("expected Prerequisites ['zone_0'], got %v", zone.Prerequisites)
	}

	if zone.BoundaryX1 != 0 || zone.BoundaryX2 != 100 || zone.BoundaryY1 != 0 || zone.BoundaryY2 != 100 {
		t.Errorf("boundaries not set correctly")
	}

	if zone.UnlockedAt != nil {
		t.Error("expected UnlockedAt to be nil for newly created zone")
	}
}

// TestZoneStateCreationWithNilPrerequisites validates that nil prerequisites are converted to empty slice.
func TestZoneStateCreationWithNilPrerequisites(t *testing.T) {
	zone := NewZoneState("zone_0", "Start", 0, nil, 0, 50, 0, 50)

	if zone.Prerequisites == nil {
		t.Error("expected Prerequisites to be empty slice, got nil")
	}

	if len(zone.Prerequisites) != 0 {
		t.Errorf("expected empty Prerequisites slice, got length %d", len(zone.Prerequisites))
	}
}

// TestZoneIsUnlocked validates IsUnlocked method.
func TestZoneIsUnlocked(t *testing.T) {
	zone := NewZoneState("zone_1", "Test", 50, []string{}, 0, 100, 0, 100)
	now := time.Now()

	// Initially locked
	if zone.IsUnlocked(now) {
		t.Error("expected zone to be locked initially")
	}

	// Unlock it
	zone.UnlockedAt = &now

	if !zone.IsUnlocked(now) {
		t.Error("expected zone to be unlocked after setting UnlockedAt")
	}
}

// TestZoneIsWithinBounds validates boundary checking.
func TestZoneIsWithinBounds(t *testing.T) {
	zone := NewZoneState("zone_1", "Test", 50, []string{}, 10, 50, 20, 80)

	testCases := []struct {
		x        float32
		y        float32
		expected bool
		desc     string
	}{
		{25, 50, true, "center of zone"},
		{10, 20, true, "at min boundaries"},
		{50, 80, true, "at max boundaries"},
		{5, 50, false, "x too small"},
		{55, 50, false, "x too large"},
		{25, 15, false, "y too small"},
		{25, 85, false, "y too large"},
		{10.5, 20.5, true, "just inside boundaries"},
		{9.9, 50, false, "just outside x"},
		{25, 19.9, false, "just outside y"},
	}

	for _, tc := range testCases {
		result := zone.IsWithinBounds(tc.x, tc.y)
		if result != tc.expected {
			t.Errorf("%s: IsWithinBounds(%.1f, %.1f) = %v, expected %v", tc.desc, tc.x, tc.y, result, tc.expected)
		}
	}
}

// TestZoneCanUnlockSuccess validates successful unlock conditions.
func TestZoneCanUnlockSuccess(t *testing.T) {
	zone := NewZoneState("zone_1", "Test", 50, []string{"zone_0"}, 0, 100, 0, 100)

	canUnlock, reason := zone.CanUnlock(100, []string{"zone_0"})

	if !canUnlock {
		t.Errorf("expected zone to be unlockable, reason: %q", reason)
	}

	if reason != "" {
		t.Errorf("expected empty reason on success, got %q", reason)
	}
}

// TestZoneCanUnlockInsufficientHoney validates honey requirement validation.
func TestZoneCanUnlockInsufficientHoney(t *testing.T) {
	zone := NewZoneState("zone_1", "Test", 100, []string{"zone_0"}, 0, 100, 0, 100)

	canUnlock, reason := zone.CanUnlock(50, []string{"zone_0"})

	if canUnlock {
		t.Error("expected unlock to fail with insufficient honey")
	}

	if reason != "insufficient_honey" {
		t.Errorf("expected reason 'insufficient_honey', got %q", reason)
	}
}

// TestZoneCanUnlockUnmetPrerequisites validates prerequisite validation.
func TestZoneCanUnlockUnmetPrerequisites(t *testing.T) {
	zone := NewZoneState("zone_2", "Test", 50, []string{"zone_0", "zone_1"}, 0, 100, 0, 100)

	// Missing zone_1 prerequisite
	canUnlock, reason := zone.CanUnlock(100, []string{"zone_0"})

	if canUnlock {
		t.Error("expected unlock to fail with unmet prerequisites")
	}

	if reason != "unmet_prerequisites" {
		t.Errorf("expected reason 'unmet_prerequisites', got %q", reason)
	}
}

// TestZoneCanUnlockAlreadyUnlocked validates already unlocked check.
func TestZoneCanUnlockAlreadyUnlocked(t *testing.T) {
	zone := NewZoneState("zone_1", "Test", 50, []string{}, 0, 100, 0, 100)
	now := time.Now()
	zone.UnlockedAt = &now

	canUnlock, reason := zone.CanUnlock(100, []string{})

	if canUnlock {
		t.Error("expected unlock to fail for already unlocked zone")
	}

	if reason != "already_unlocked" {
		t.Errorf("expected reason 'already_unlocked', got %q", reason)
	}
}

// TestZoneCanUnlockNoPrerequisites validates zone with no prerequisites.
func TestZoneCanUnlockNoPrerequisites(t *testing.T) {
	zone := NewZoneState("zone_0", "Start", 0, []string{}, 0, 50, 0, 50)

	canUnlock, reason := zone.CanUnlock(0, []string{})

	if !canUnlock {
		t.Errorf("expected zone with no prerequisites to be unlockable, reason: %q", reason)
	}
}

// TestZoneRegistryCreation validates that NewZoneRegistry creates 5 zones.
func TestZoneRegistryCreation(t *testing.T) {
	registry := NewZoneRegistry()

	if len(registry.Zones) != 5 {
		t.Errorf("expected 5 zones, got %d", len(registry.Zones))
	}

	expectedZones := []string{"zone_0", "zone_1", "zone_2", "zone_3", "zone_4"}
	for _, id := range expectedZones {
		if _, exists := registry.Zones[id]; !exists {
			t.Errorf("expected zone %q to exist in registry", id)
		}
	}
}

// TestZoneRegistryZone0Properties validates Zone 0 properties.
func TestZoneRegistryZone0Properties(t *testing.T) {
	registry := NewZoneRegistry()
	zone := registry.GetZone("zone_0")

	if zone == nil {
		t.Fatal("zone_0 not found")
	}

	if zone.Name != "Prado de Flores" {
		t.Errorf("expected name 'Prado de Flores', got %q", zone.Name)
	}

	if zone.CostHoney != 0 {
		t.Errorf("expected cost 0, got %d", zone.CostHoney)
	}

	if len(zone.Prerequisites) != 0 {
		t.Errorf("expected no prerequisites, got %v", zone.Prerequisites)
	}

	if !zone.IsUnlocked(time.Now()) {
		t.Error("zone_0 should be unlocked (starting zone)")
	}

	if zone.BoundaryX1 != 0 || zone.BoundaryX2 != 50 || zone.BoundaryY1 != 0 || zone.BoundaryY2 != 50 {
		t.Errorf("zone_0 boundaries incorrect: [%.0f,%.0f,%.0f,%.0f]", zone.BoundaryX1, zone.BoundaryX2, zone.BoundaryY1, zone.BoundaryY2)
	}
}

// TestZoneRegistryZone1Properties validates Zone 1 properties.
func TestZoneRegistryZone1Properties(t *testing.T) {
	registry := NewZoneRegistry()
	zone := registry.GetZone("zone_1")

	if zone == nil {
		t.Fatal("zone_1 not found")
	}

	if zone.Name != "Bosque Central" {
		t.Errorf("expected name 'Bosque Central', got %q", zone.Name)
	}

	if zone.CostHoney != 50 {
		t.Errorf("expected cost 50, got %d", zone.CostHoney)
	}

	if len(zone.Prerequisites) != 1 || zone.Prerequisites[0] != "zone_0" {
		t.Errorf("expected prerequisites [zone_0], got %v", zone.Prerequisites)
	}

	if zone.BoundaryX1 != 50 || zone.BoundaryX2 != 100 || zone.BoundaryY1 != 0 || zone.BoundaryY2 != 50 {
		t.Errorf("zone_1 boundaries incorrect: [%.0f,%.0f,%.0f,%.0f]", zone.BoundaryX1, zone.BoundaryX2, zone.BoundaryY1, zone.BoundaryY2)
	}
}

// TestZoneRegistryZone2Properties validates Zone 2 properties.
func TestZoneRegistryZone2Properties(t *testing.T) {
	registry := NewZoneRegistry()
	zone := registry.GetZone("zone_2")

	if zone == nil {
		t.Fatal("zone_2 not found")
	}

	if zone.Name != "Colmeia Rainha" {
		t.Errorf("expected name 'Colmeia Rainha', got %q", zone.Name)
	}

	if zone.CostHoney != 150 {
		t.Errorf("expected cost 150, got %d", zone.CostHoney)
	}

	if len(zone.Prerequisites) != 1 || zone.Prerequisites[0] != "zone_1" {
		t.Errorf("expected prerequisites [zone_1], got %v", zone.Prerequisites)
	}

	if zone.BoundaryX1 != 0 || zone.BoundaryX2 != 50 || zone.BoundaryY1 != 50 || zone.BoundaryY2 != 100 {
		t.Errorf("zone_2 boundaries incorrect: [%.0f,%.0f,%.0f,%.0f]", zone.BoundaryX1, zone.BoundaryX2, zone.BoundaryY1, zone.BoundaryY2)
	}
}

// TestZoneRegistryZone3Properties validates Zone 3 properties.
func TestZoneRegistryZone3Properties(t *testing.T) {
	registry := NewZoneRegistry()
	zone := registry.GetZone("zone_3")

	if zone == nil {
		t.Fatal("zone_3 not found")
	}

	if zone.Name != "Campos Selvagens" {
		t.Errorf("expected name 'Campos Selvagens', got %q", zone.Name)
	}

	if zone.CostHoney != 300 {
		t.Errorf("expected cost 300, got %d", zone.CostHoney)
	}

	if len(zone.Prerequisites) != 1 || zone.Prerequisites[0] != "zone_2" {
		t.Errorf("expected prerequisites [zone_2], got %v", zone.Prerequisites)
	}

	if zone.BoundaryX1 != 50 || zone.BoundaryX2 != 100 || zone.BoundaryY1 != 50 || zone.BoundaryY2 != 100 {
		t.Errorf("zone_3 boundaries incorrect: [%.0f,%.0f,%.0f,%.0f]", zone.BoundaryX1, zone.BoundaryX2, zone.BoundaryY1, zone.BoundaryY2)
	}
}

// TestZoneRegistryZone4Properties validates Zone 4 properties.
func TestZoneRegistryZone4Properties(t *testing.T) {
	registry := NewZoneRegistry()
	zone := registry.GetZone("zone_4")

	if zone == nil {
		t.Fatal("zone_4 not found")
	}

	if zone.Name != "Caverna Profunda" {
		t.Errorf("expected name 'Caverna Profunda', got %q", zone.Name)
	}

	if zone.CostHoney != 500 {
		t.Errorf("expected cost 500, got %d", zone.CostHoney)
	}

	if len(zone.Prerequisites) != 1 || zone.Prerequisites[0] != "zone_3" {
		t.Errorf("expected prerequisites [zone_3], got %v", zone.Prerequisites)
	}

	if zone.BoundaryX1 != 25 || zone.BoundaryX2 != 75 || zone.BoundaryY1 != 100 || zone.BoundaryY2 != 150 {
		t.Errorf("zone_4 boundaries incorrect: [%.0f,%.0f,%.0f,%.0f]", zone.BoundaryX1, zone.BoundaryX2, zone.BoundaryY1, zone.BoundaryY2)
	}
}

// TestZoneRegistryGetZone validates GetZone method.
func TestZoneRegistryGetZone(t *testing.T) {
	registry := NewZoneRegistry()

	zone := registry.GetZone("zone_0")
	if zone == nil {
		t.Error("expected to find zone_0")
	}

	zone = registry.GetZone("nonexistent")
	if zone != nil {
		t.Error("expected nil for nonexistent zone")
	}
}

// TestZoneRegistryGetAllZones validates GetAllZones method.
func TestZoneRegistryGetAllZones(t *testing.T) {
	registry := NewZoneRegistry()
	zones := registry.GetAllZones()

	if len(zones) != 5 {
		t.Errorf("expected 5 zones, got %d", len(zones))
	}

	// Verify all zones have unique IDs
	seen := make(map[string]bool)
	for _, zone := range zones {
		if seen[zone.ID] {
			t.Errorf("duplicate zone ID: %q", zone.ID)
		}
		seen[zone.ID] = true
	}
}

// TestMultipleZoneUnlockSequence validates unlocking zones in sequence with prerequisites.
func TestMultipleZoneUnlockSequence(t *testing.T) {
	registry := NewZoneRegistry()

	// Start: only zone_0 is unlocked
	unlockedZones := []string{"zone_0"}
	playerHoney := 0

	// Try to unlock zone_1 without enough honey
	zone1 := registry.GetZone("zone_1")
	canUnlock, reason := zone1.CanUnlock(playerHoney, unlockedZones)
	if canUnlock {
		t.Error("should not unlock zone_1 without enough honey")
	}
	if reason != "insufficient_honey" {
		t.Errorf("expected 'insufficient_honey', got %q", reason)
	}

	// Get 50 honey
	playerHoney = 50

	// Unlock zone_1
	canUnlock, reason = zone1.CanUnlock(playerHoney, unlockedZones)
	if !canUnlock {
		t.Errorf("should unlock zone_1, reason: %q", reason)
	}
	now := time.Now()
	zone1.UnlockedAt = &now
	unlockedZones = append(unlockedZones, "zone_1")
	playerHoney -= zone1.CostHoney

	// Try to unlock zone_2
	zone2 := registry.GetZone("zone_2")
	canUnlock, reason = zone2.CanUnlock(playerHoney, unlockedZones)
	if canUnlock {
		t.Error("should not unlock zone_2 without enough honey")
	}

	// Get 150 honey
	playerHoney = 150

	// Unlock zone_2
	canUnlock, reason = zone2.CanUnlock(playerHoney, unlockedZones)
	if !canUnlock {
		t.Errorf("should unlock zone_2, reason: %q", reason)
	}

	// Try to unlock zone_4 without unlocking zone_3 first
	zone4 := registry.GetZone("zone_4")
	canUnlock, reason = zone4.CanUnlock(1000, unlockedZones)
	if canUnlock {
		t.Error("should not unlock zone_4 without unlocking zone_3 first")
	}
	if reason != "unmet_prerequisites" {
		t.Errorf("expected 'unmet_prerequisites', got %q", reason)
	}
}

// TestZoneValidateZoneTransition validates zone transition validation.
func TestZoneValidateZoneTransition(t *testing.T) {
	registry := NewZoneRegistry()

	// zone_0 should be accessible (already unlocked)
	canMove, reason := registry.ValidateZoneTransition("zone_0", []string{})
	if !canMove {
		t.Errorf("should allow transition to zone_0, reason: %q", reason)
	}

	// zone_1 should not be accessible (not unlocked)
	canMove, reason = registry.ValidateZoneTransition("zone_1", []string{})
	if canMove {
		t.Error("should not allow transition to zone_1 (not unlocked)")
	}
	if reason != "zone_locked" {
		t.Errorf("expected 'zone_locked', got %q", reason)
	}

	// nonexistent zone
	canMove, reason = registry.ValidateZoneTransition("zone_999", []string{})
	if canMove {
		t.Error("should not allow transition to nonexistent zone")
	}
	if reason == "" {
		t.Error("expected non-empty reason for nonexistent zone")
	}
}

// TestZoneEdgeCaseEmptyBounds validates zone with zero-size bounds.
func TestZoneEdgeCaseEmptyBounds(t *testing.T) {
	zone := NewZoneState("zone_empty", "Empty", 0, []string{}, 10, 10, 20, 20)

	// Only exact point should be within bounds
	if !zone.IsWithinBounds(10, 20) {
		t.Error("expected point (10, 20) to be within bounds")
	}

	if zone.IsWithinBounds(10.1, 20) {
		t.Error("expected point (10.1, 20) to be outside bounds")
	}
}

// TestZoneEdgeCaseNegativeBounds validates zone with negative coordinates.
func TestZoneEdgeCaseNegativeBounds(t *testing.T) {
	zone := NewZoneState("zone_neg", "Negative", 0, []string{}, -50, -10, -30, 0)

	if !zone.IsWithinBounds(-30, -15) {
		t.Error("expected point (-30, -15) to be within negative bounds")
	}

	if zone.IsWithinBounds(0, 0) {
		t.Error("expected point (0, 0) to be outside negative bounds")
	}
}

// TestZoneMultiplePrerequisites validates zone with multiple prerequisites.
func TestZoneMultiplePrerequisites(t *testing.T) {
	zone := NewZoneState("zone_multi", "Multi", 100, []string{"zone_0", "zone_1", "zone_2"}, 0, 100, 0, 100)

	// Missing all prerequisites
	canUnlock, reason := zone.CanUnlock(100, []string{})
	if canUnlock {
		t.Error("should fail with missing prerequisites")
	}
	if reason != "unmet_prerequisites" {
		t.Errorf("expected 'unmet_prerequisites', got %q", reason)
	}

	// Have some prerequisites
	canUnlock, reason = zone.CanUnlock(100, []string{"zone_0", "zone_1"})
	if canUnlock {
		t.Error("should fail with missing zone_2")
	}

	// Have all prerequisites
	canUnlock, reason = zone.CanUnlock(100, []string{"zone_0", "zone_1", "zone_2"})
	if !canUnlock {
		t.Errorf("should succeed with all prerequisites, reason: %q", reason)
	}
}

// TestZoneHighHoneyCost validates zone with high honey cost.
func TestZoneHighHoneyCost(t *testing.T) {
	zone := NewZoneState("zone_expensive", "Expensive", 10000, []string{}, 0, 100, 0, 100)

	canUnlock, reason := zone.CanUnlock(9999, []string{})
	if canUnlock {
		t.Error("should fail with insufficient honey (off by one)")
	}

	canUnlock, reason = zone.CanUnlock(10000, []string{})
	if !canUnlock {
		t.Errorf("should succeed with exact honey amount, reason: %q", reason)
	}

	canUnlock, reason = zone.CanUnlock(10001, []string{})
	if !canUnlock {
		t.Errorf("should succeed with more than required honey, reason: %q", reason)
	}
}

// TestZoneBoundaryPrecision validates float32 boundary precision.
func TestZoneBoundaryPrecision(t *testing.T) {
	zone := NewZoneState("zone_precise", "Precise", 0, []string{}, 0.5, 99.5, 0.5, 99.5)

	if !zone.IsWithinBounds(0.5, 0.5) {
		t.Error("expected boundary point to be within bounds")
	}

	if !zone.IsWithinBounds(99.5, 99.5) {
		t.Error("expected boundary point to be within bounds")
	}

	if zone.IsWithinBounds(0.4, 50) {
		t.Error("expected point just outside boundary to be outside")
	}
}

// TestZoneCostZero validates that cost 0 is valid.
func TestZoneCostZero(t *testing.T) {
	zone := NewZoneState("zone_free", "Free", 0, []string{}, 0, 50, 0, 50)

	if zone.CostHoney != 0 {
		t.Errorf("expected cost 0, got %d", zone.CostHoney)
	}

	canUnlock, reason := zone.CanUnlock(0, []string{})
	if !canUnlock {
		t.Errorf("should unlock free zone with 0 honey, reason: %q", reason)
	}
}
