package zones

import "testing"

func TestNewZoneStateCarriesEpic02Metadata(t *testing.T) {
	zone := NewZoneState("zone_1", "Sunflower Ridge", 25, []string{"zone_0"}, 20, 50, -50, 50)

	if zone.ZoneID != SunflowerRidgeZoneID {
		t.Fatalf("expected normalized zone ID %q, got %q", SunflowerRidgeZoneID, zone.ZoneID)
	}
	if zone.DisplayName != "Sunflower Ridge" {
		t.Fatalf("expected display name to be preserved, got %q", zone.DisplayName)
	}
	if zone.UnlockHoneyCost != 25 {
		t.Fatalf("expected unlock honey cost 25, got %d", zone.UnlockHoneyCost)
	}
	if len(zone.RequiredZoneIDs) != 1 || zone.RequiredZoneIDs[0] != StarterMeadowZoneID {
		t.Fatalf("expected normalized prerequisite %q, got %v", StarterMeadowZoneID, zone.RequiredZoneIDs)
	}
	if zone.Bounds.MinX != 20 || zone.Bounds.MaxX != 50 || zone.Bounds.MinY != -50 || zone.Bounds.MaxY != 50 {
		t.Fatalf("unexpected bounds: %+v", zone.Bounds)
	}
	if zone.IsStarter {
		t.Fatalf("sunflower ridge should not be starter")
	}
}

func TestNormalizeZoneIDsPreservesOrderAndDropsDuplicates(t *testing.T) {
	normalized := NormalizeZoneIDs([]string{"zone_0", StarterMeadowZoneID, "zone_1", SunflowerRidgeZoneID})
	expected := []string{StarterMeadowZoneID, SunflowerRidgeZoneID}

	if len(normalized) != len(expected) {
		t.Fatalf("expected %d zone IDs, got %d (%v)", len(expected), len(normalized), normalized)
	}
	for index := range expected {
		if normalized[index] != expected[index] {
			t.Fatalf("expected normalized[%d] = %q, got %q", index, expected[index], normalized[index])
		}
	}
}

func TestZoneRegistryStarterSlice(t *testing.T) {
	registry := NewZoneRegistry()
	allZones := registry.GetAllZones()

	if len(allZones) != 2 {
		t.Fatalf("expected 2 zones in starter slice, got %d", len(allZones))
	}

	starter := registry.GetZone(StarterMeadowZoneID)
	if starter == nil || !starter.IsStarter {
		t.Fatalf("expected starter meadow to exist and be starter")
	}

	ridge := registry.GetZone(SunflowerRidgeZoneID)
	if ridge == nil {
		t.Fatalf("expected sunflower ridge to exist")
	}
	if ridge.UnlockHoneyCost != 25 {
		t.Fatalf("expected sunflower ridge cost 25, got %d", ridge.UnlockHoneyCost)
	}
}

func TestValidateZoneTransitionUsesPlayerUnlocks(t *testing.T) {
	registry := NewZoneRegistry()

	if canMove, reason := registry.ValidateZoneTransition(StarterMeadowZoneID, nil); !canMove || reason != "" {
		t.Fatalf("expected starter meadow access, got canMove=%v reason=%q", canMove, reason)
	}

	if canMove, reason := registry.ValidateZoneTransition(SunflowerRidgeZoneID, nil); canMove || reason != "zone_locked" {
		t.Fatalf("expected locked sunflower ridge, got canMove=%v reason=%q", canMove, reason)
	}

	if canMove, reason := registry.ValidateZoneTransition(SunflowerRidgeZoneID, []string{StarterMeadowZoneID, SunflowerRidgeZoneID}); !canMove || reason != "" {
		t.Fatalf("expected unlocked sunflower ridge access, got canMove=%v reason=%q", canMove, reason)
	}
}
