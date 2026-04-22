package zones

import (
	"fmt"
	"time"
)

// ZoneState represents a game zone with unlock costs, prerequisites, spatial bounds, and per-player unlock status.
// ZoneState is authoritative on the server: unlock validation, cost checking, and spatial boundaries are enforced here.
type ZoneState struct {
	// ID is a unique identifier for the zone (e.g., "zone_0", "zone_1").
	ID string

	// Name is a human-readable name for the zone (e.g., "Prado de Flores").
	Name string

	// CostHoney is the amount of honey required to unlock this zone.
	// A cost of 0 indicates a free/starting zone that is always available.
	CostHoney int

	// Prerequisites is a list of zone IDs that must be unlocked before this zone can be unlocked.
	// Empty slice means no prerequisites.
	Prerequisites []string

	// BoundaryX1, BoundaryX2, BoundaryY1, BoundaryY2 define the spatial limits of the zone in world coordinates.
	// X range: [BoundaryX1, BoundaryX2], Y range: [BoundaryY1, BoundaryY2].
	BoundaryX1 float32
	BoundaryX2 float32
	BoundaryY1 float32
	BoundaryY2 float32

	// UnlockedAt is the timestamp when this zone was unlocked by the player.
	// nil indicates the zone is locked; non-nil indicates the zone is unlocked.
	UnlockedAt *time.Time
}

// IsUnlocked checks if the zone is currently unlocked (UnlockedAt is not nil).
func (z *ZoneState) IsUnlocked(now time.Time) bool {
	return z.UnlockedAt != nil
}

// CanUnlock validates whether a zone can be unlocked given the player's honey and list of already-unlocked zone IDs.
// Returns (canUnlock bool, reason string).
// Reasons for failure:
//   - "insufficient_honey": player has less honey than CostHoney
//   - "unmet_prerequisites": at least one prerequisite zone is not unlocked
//   - "already_unlocked": zone is already unlocked
//
// Returns (true, "") if all conditions are met.
func (z *ZoneState) CanUnlock(playerHoney int, unlockedZones []string) (bool, string) {
	// Check if already unlocked
	if z.UnlockedAt != nil {
		return false, "already_unlocked"
	}

	// Check honey requirement
	if playerHoney < z.CostHoney {
		return false, "insufficient_honey"
	}

	// Check prerequisites
	if len(z.Prerequisites) > 0 {
		unlockedMap := make(map[string]bool)
		for _, id := range unlockedZones {
			unlockedMap[id] = true
		}

		for _, prereq := range z.Prerequisites {
			if !unlockedMap[prereq] {
				return false, "unmet_prerequisites"
			}
		}
	}

	return true, ""
}

// IsWithinBounds checks if a position (x, y) is within the zone's spatial boundaries.
func (z *ZoneState) IsWithinBounds(x, y float32) bool {
	return x >= z.BoundaryX1 && x <= z.BoundaryX2 &&
		y >= z.BoundaryY1 && y <= z.BoundaryY2
}

// NewZoneState is a factory function that creates a new ZoneState with the given parameters.
// UnlockedAt is initialized to nil (zone starts locked).
func NewZoneState(id, name string, costHoney int, prerequisites []string, x1, x2, y1, y2 float32) *ZoneState {
	// Ensure prerequisites is not nil (use empty slice instead)
	if prerequisites == nil {
		prerequisites = []string{}
	}

	return &ZoneState{
		ID:            id,
		Name:          name,
		CostHoney:     costHoney,
		Prerequisites: prerequisites,
		BoundaryX1:    x1,
		BoundaryX2:    x2,
		BoundaryY1:    y1,
		BoundaryY2:    y2,
		UnlockedAt:    nil,
	}
}

// ZoneRegistry holds all zone definitions for the game.
type ZoneRegistry struct {
	// Zones is a map of zone ID to ZoneState, allowing O(1) lookup.
	Zones map[string]*ZoneState
}

// NewZoneRegistry creates and returns a new ZoneRegistry with all 5 default zones.
// Zone definitions:
//
//   - Zone 0 "Prado de Flores": cost 0 (starting zone, always available), no prerequisites, bounds [0, 50, 0, 50]
//   - Zone 1 "Bosque Central": cost 50 honey, prerequisite zone_0, bounds [50, 100, 0, 50]
//   - Zone 2 "Colmeia Rainha": cost 150 honey, prerequisite zone_1, bounds [0, 50, 50, 100]
//   - Zone 3 "Campos Selvagens": cost 300 honey, prerequisite zone_2, bounds [50, 100, 50, 100]
//   - Zone 4 "Caverna Profunda": cost 500 honey, prerequisite zone_3, bounds [25, 75, 100, 150]
func NewZoneRegistry() *ZoneRegistry {
	registry := &ZoneRegistry{
		Zones: make(map[string]*ZoneState),
	}

	// Zone 0: Prado de Flores (starting zone)
	zone0 := NewZoneState("zone_0", "Prado de Flores", 0, []string{}, 0, 50, 0, 50)
	zone0.UnlockedAt = &time.Time{} // Start unlocked (set to zero time; caller can use a real timestamp if needed)
	registry.Zones["zone_0"] = zone0

	// Zone 1: Bosque Central
	zone1 := NewZoneState("zone_1", "Bosque Central", 50, []string{"zone_0"}, 50, 100, 0, 50)
	registry.Zones["zone_1"] = zone1

	// Zone 2: Colmeia Rainha
	zone2 := NewZoneState("zone_2", "Colmeia Rainha", 150, []string{"zone_1"}, 0, 50, 50, 100)
	registry.Zones["zone_2"] = zone2

	// Zone 3: Campos Selvagens
	zone3 := NewZoneState("zone_3", "Campos Selvagens", 300, []string{"zone_2"}, 50, 100, 50, 100)
	registry.Zones["zone_3"] = zone3

	// Zone 4: Caverna Profunda
	zone4 := NewZoneState("zone_4", "Caverna Profunda", 500, []string{"zone_3"}, 25, 75, 100, 150)
	registry.Zones["zone_4"] = zone4

	return registry
}

// GetZone returns the zone with the given ID, or nil if not found.
func (r *ZoneRegistry) GetZone(id string) *ZoneState {
	return r.Zones[id]
}

// GetAllZones returns a slice of all zones in the registry.
func (r *ZoneRegistry) GetAllZones() []*ZoneState {
	zones := make([]*ZoneState, 0, len(r.Zones))
	for _, zone := range r.Zones {
		zones = append(zones, zone)
	}
	return zones
}

// ValidateZoneTransition checks if a player can move to a given zone.
// Returns (canMove bool, reason string).
func (r *ZoneRegistry) ValidateZoneTransition(targetZoneID string, unlockedZones []string) (bool, string) {
	zone := r.GetZone(targetZoneID)
	if zone == nil {
		return false, fmt.Sprintf("zone_not_found: %s", targetZoneID)
	}

	// Check if the zone is unlocked
	if !zone.IsUnlocked(time.Now()) {
		return false, "zone_locked"
	}

	return true, ""
}
