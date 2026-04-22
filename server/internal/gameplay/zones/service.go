package zones

import (
	"sync"
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

// ZoneService manages zone access validation and unlock operations for players.
// It provides methods to check if a player can access a zone and to unlock zones.
// The service is authoritative on the server and enforces all zone unlock restrictions.
type ZoneService struct {
	mu       sync.RWMutex
	registry *ZoneRegistry
}

// NewZoneService creates and returns a new ZoneService with the default zone registry.
func NewZoneService() *ZoneService {
	return &ZoneService{
		registry: NewZoneRegistry(),
	}
}

// CanAccessZone validates whether a player can access a given zone.
// Returns (canAccess bool, reason string) where:
//   - canAccess: true if the player can access the zone, false otherwise
//   - reason: "" (empty) on success, or one of:
//     - "zone_not_found": zone ID does not exist in the registry
//     - "zone_locked": zone exists but player has not unlocked it
//
// Access is allowed if:
// 1. The zone exists in the registry
// 2. The zone is in the player's UnlockedZoneIDs list
func (s *ZoneService) CanAccessZone(player *loopbase.PlayerProgress, zoneID string) (bool, string) {
	if player == nil {
		return false, "player_progress_nil"
	}

	if zoneID == "" {
		return false, "zone_id_empty"
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	// Check if zone exists in registry
	zone := s.registry.GetZone(zoneID)
	if zone == nil {
		return false, "zone_not_found"
	}

	// Check if player has unlocked this zone
	for _, unlockedZoneID := range player.UnlockedZoneIDs {
		if unlockedZoneID == zoneID {
			return true, ""
		}
	}

	// Zone exists but is not unlocked
	return false, "zone_locked"
}

// UnlockZone attempts to unlock a zone for a player.
// It validates:
//   1. Zone exists in registry
//   2. Zone not already unlocked
//   3. Player has sufficient honey
//   4. All prerequisite zones are unlocked
//
// On success:
//   - Deducts honey from player
//   - Adds zoneID to player's UnlockedZoneIDs
//   - Marks zone as unlocked
//   - Returns (true, honeyCost, "")
//
// On failure, returns (false, 0, reason) where reason is one of:
//   - "zone_not_found": invalid zoneID
//   - "zone_already_unlocked": player already owns this zone
//   - "insufficient_honey": not enough honey to unlock
//   - "prerequisites_not_met": required zones not unlocked first
//   - "zone_id_empty": zoneID is empty string
//   - "invalid_request": player is nil
//
// Note: This method MODIFIES the player state directly.
// The caller is responsible for persisting changes or handling rollback.
func (s *ZoneService) UnlockZone(player *loopbase.PlayerProgress, zoneID string, now time.Time) (success bool, honeyCost int, reason string) {
	if s == nil || player == nil {
		return false, 0, "invalid_request"
	}

	if zoneID == "" {
		return false, 0, "zone_id_empty"
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Validate zone exists
	zone := s.registry.GetZone(zoneID)
	if zone == nil {
		return false, 0, "zone_not_found"
	}

	// 2. Check if already unlocked
	if zone.IsUnlocked(now) {
		return false, 0, "zone_already_unlocked"
	}

	// 3. Check honey available
	if player.Honey < zone.CostHoney {
		return false, 0, "insufficient_honey"
	}

	// 4. Check prerequisites
	if len(zone.Prerequisites) > 0 {
		unlockedMap := make(map[string]bool)
		for _, id := range player.UnlockedZoneIDs {
			unlockedMap[id] = true
		}

		for _, prereq := range zone.Prerequisites {
			if !unlockedMap[prereq] {
				return false, 0, "prerequisites_not_met"
			}
		}
	}

	// All validations passed, apply changes
	// 5. Deduct honey
	player.Honey -= zone.CostHoney

	// 6. Mark zone as unlocked
	zone.UnlockedAt = &now

	// 7. Add to player's unlocked zones
	// Check if already in slice (defensive programming)
	isAlreadyInList := false
	for _, id := range player.UnlockedZoneIDs {
		if id == zoneID {
			isAlreadyInList = true
			break
		}
	}
	if !isAlreadyInList {
		player.UnlockedZoneIDs = append(player.UnlockedZoneIDs, zoneID)
	}

	player.UpdatedAt = now

	return true, zone.CostHoney, ""
}

// GetZoneState returns all zones from the registry as a slice.
// Used to provide zone metadata and unlock status to clients.
// Caller should pass the player's UnlockedZoneIDs to determine per-zone unlock status.
func (s *ZoneService) GetZoneState() []*ZoneState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.registry.GetAllZones()
}

// GetRegistry returns the zone registry (read-only for testing).
// This method is primarily used for testing and diagnostics.
func (s *ZoneService) GetRegistry() *ZoneRegistry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.registry
}
