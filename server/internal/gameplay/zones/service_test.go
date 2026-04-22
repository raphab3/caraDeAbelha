package zones

import (
	"testing"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

func TestUnlockZoneSuccessForStarterSlice(t *testing.T) {
	service := NewZoneService()
	now := time.Now()
	player := &loopbase.PlayerProgress{
		PlayerID:        "player-1",
		Honey:           30,
		UnlockedZoneIDs: DefaultUnlockedZoneIDs(),
		UpdatedAt:       now,
	}

	success, honeyCost, reason := service.UnlockZone(player, SunflowerRidgeZoneID, now)
	if !success || reason != "" {
		t.Fatalf("expected successful unlock, got success=%v reason=%q", success, reason)
	}
	if honeyCost != 25 {
		t.Fatalf("expected honey cost 25, got %d", honeyCost)
	}
	if player.Honey != 5 {
		t.Fatalf("expected remaining honey 5, got %d", player.Honey)
	}
	if len(player.UnlockedZoneIDs) != 2 || player.UnlockedZoneIDs[1] != SunflowerRidgeZoneID {
		t.Fatalf("expected unlocked zones to include sunflower ridge, got %v", player.UnlockedZoneIDs)
	}
}

func TestUnlockZoneFailsWithoutHoney(t *testing.T) {
	service := NewZoneService()
	player := &loopbase.PlayerProgress{
		PlayerID:        "player-1",
		Honey:           24,
		UnlockedZoneIDs: DefaultUnlockedZoneIDs(),
	}

	success, honeyCost, reason := service.UnlockZone(player, SunflowerRidgeZoneID, time.Now())
	if success || honeyCost != 0 || reason != "insufficient_honey" {
		t.Fatalf("expected insufficient_honey, got success=%v honeyCost=%d reason=%q", success, honeyCost, reason)
	}
}

func TestUnlockZoneIsPerPlayer(t *testing.T) {
	service := NewZoneService()
	now := time.Now()
	playerOne := &loopbase.PlayerProgress{
		PlayerID:        "player-1",
		Honey:           25,
		UnlockedZoneIDs: DefaultUnlockedZoneIDs(),
		UpdatedAt:       now,
	}
	playerTwo := &loopbase.PlayerProgress{
		PlayerID:        "player-2",
		Honey:           25,
		UnlockedZoneIDs: DefaultUnlockedZoneIDs(),
		UpdatedAt:       now,
	}

	success, _, reason := service.UnlockZone(playerOne, SunflowerRidgeZoneID, now)
	if !success || reason != "" {
		t.Fatalf("expected player one unlock to succeed, got success=%v reason=%q", success, reason)
	}

	canAccess, accessReason := service.CanAccessZone(playerTwo, SunflowerRidgeZoneID)
	if canAccess || accessReason != "zone_locked" {
		t.Fatalf("expected player two zone to remain locked, got canAccess=%v reason=%q", canAccess, accessReason)
	}
}

func TestGetZoneStateReturnsEpic02Catalog(t *testing.T) {
	service := NewZoneService()
	zones := service.GetZoneState()

	if len(zones) != 2 {
		t.Fatalf("expected 2 zones, got %d", len(zones))
	}
	if zones[0].ZoneID != StarterMeadowZoneID || zones[1].ZoneID != SunflowerRidgeZoneID {
		t.Fatalf("unexpected zone order: %q, %q", zones[0].ZoneID, zones[1].ZoneID)
	}
}
