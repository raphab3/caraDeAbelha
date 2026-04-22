package zones

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

const (
	StarterMeadowZoneID  = "zone:starter_meadow"
	SunflowerRidgeZoneID = "zone:sunflower_ridge"
)

var legacyZoneIDs = map[string]string{
	"zone_0": StarterMeadowZoneID,
	"zone_1": SunflowerRidgeZoneID,
}

type ZoneBounds struct {
	MinX float32 `json:"minX"`
	MaxX float32 `json:"maxX"`
	MinY float32 `json:"minY"`
	MaxY float32 `json:"maxY"`
}

func NormalizeZoneID(zoneID string) string {
	trimmed := strings.TrimSpace(zoneID)
	if mapped, ok := legacyZoneIDs[trimmed]; ok {
		return mapped
	}

	return trimmed
}

func NormalizeZoneIDs(zoneIDs []string) []string {
	if len(zoneIDs) == 0 {
		return []string{}
	}

	normalized := make([]string, 0, len(zoneIDs))
	seen := make(map[string]struct{}, len(zoneIDs))
	for _, zoneID := range zoneIDs {
		normalizedID := NormalizeZoneID(zoneID)
		if normalizedID == "" {
			continue
		}
		if _, ok := seen[normalizedID]; ok {
			continue
		}
		seen[normalizedID] = struct{}{}
		normalized = append(normalized, normalizedID)
	}

	if len(normalized) == 0 {
		return []string{}
	}

	return normalized
}

func DefaultCurrentZoneID() string {
	return StarterMeadowZoneID
}

func DefaultUnlockedZoneIDs() []string {
	return []string{StarterMeadowZoneID}
}

// ZoneState represents a game zone with unlock costs, prerequisites, spatial bounds, and per-player unlock status.
// ZoneState is authoritative on the server: unlock validation, cost checking, and spatial boundaries are enforced here.
type ZoneState struct {
	ZoneID string `json:"zoneId"`

	DisplayName string `json:"displayName"`

	UnlockHoneyCost int `json:"unlockHoneyCost"`

	RequiredZoneIDs []string `json:"requiredZoneIds"`

	Bounds ZoneBounds `json:"bounds"`

	IsStarter bool `json:"isStarter"`

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
	return z.IsStarter || z.UnlockedAt != nil
}

func (z *ZoneState) IsUnlockedForPlayer(unlockedZoneIDs []string) bool {
	if z == nil {
		return false
	}

	if z.IsStarter {
		return true
	}

	for _, unlockedZoneID := range NormalizeZoneIDs(unlockedZoneIDs) {
		if unlockedZoneID == z.ZoneID {
			return true
		}
	}

	return false
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
	if z == nil {
		return false, "zone_not_found"
	}

	// Check if already unlocked
	if z.IsUnlockedForPlayer(unlockedZones) {
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

		for _, prereq := range z.RequiredZoneIDs {
			if !unlockedMap[prereq] {
				return false, "unmet_prerequisites"
			}
		}
	}

	return true, ""
}

// IsWithinBounds checks if a position (x, y) is within the zone's spatial boundaries.
func (z *ZoneState) IsWithinBounds(x, y float32) bool {
	return x >= z.Bounds.MinX && x <= z.Bounds.MaxX &&
		y >= z.Bounds.MinY && y <= z.Bounds.MaxY
}

// NewZoneState is a factory function that creates a new ZoneState with the given parameters.
// UnlockedAt is initialized to nil (zone starts locked).
func NewZoneState(id, name string, costHoney int, prerequisites []string, x1, x2, y1, y2 float32) *ZoneState {
	// Ensure prerequisites is not nil (use empty slice instead)
	if prerequisites == nil {
		prerequisites = []string{}
	}

	normalizedID := NormalizeZoneID(id)
	normalizedPrerequisites := NormalizeZoneIDs(prerequisites)
	bounds := ZoneBounds{MinX: x1, MaxX: x2, MinY: y1, MaxY: y2}
	isStarter := normalizedID == StarterMeadowZoneID

	return &ZoneState{
		ZoneID:          normalizedID,
		DisplayName:     name,
		UnlockHoneyCost: costHoney,
		RequiredZoneIDs: normalizedPrerequisites,
		Bounds:          bounds,
		IsStarter:       isStarter,
		ID:              normalizedID,
		Name:            name,
		CostHoney:       costHoney,
		Prerequisites:   normalizedPrerequisites,
		BoundaryX1:      x1,
		BoundaryX2:      x2,
		BoundaryY1:      y1,
		BoundaryY2:      y2,
		UnlockedAt:      nil,
	}
}

// ZoneRegistry holds all zone definitions for the game.
type ZoneRegistry struct {
	// Zones is a map of zone ID to ZoneState, allowing O(1) lookup.
	Zones map[string]*ZoneState
}

// NewZoneRegistry creates and returns the Epic 02 starter zone catalog.
func NewZoneRegistry() *ZoneRegistry {
	registry := &ZoneRegistry{
		Zones: make(map[string]*ZoneState),
	}

	starter := NewZoneState(StarterMeadowZoneID, "Starter Meadow", 0, []string{}, -50, 20, -50, 50)
	registry.Zones[starter.ZoneID] = starter

	ridge := NewZoneState(SunflowerRidgeZoneID, "Sunflower Ridge", 25, []string{StarterMeadowZoneID}, 20, 50, -50, 50)
	registry.Zones[ridge.ZoneID] = ridge

	return registry
}

// GetZone returns the zone with the given ID, or nil if not found.
func (r *ZoneRegistry) GetZone(id string) *ZoneState {
	return r.Zones[NormalizeZoneID(id)]
}

// GetAllZones returns a slice of all zones in the registry.
func (r *ZoneRegistry) GetAllZones() []*ZoneState {
	zones := make([]*ZoneState, 0, len(r.Zones))
	for _, zone := range r.Zones {
		zones = append(zones, zone)
	}
	sort.Slice(zones, func(left int, right int) bool {
		return zones[left].ZoneID < zones[right].ZoneID
	})
	return zones
}

// ValidateZoneTransition checks if a player can move to a given zone.
// Returns (canMove bool, reason string).
func (r *ZoneRegistry) ValidateZoneTransition(targetZoneID string, unlockedZones []string) (bool, string) {
	zone := r.GetZone(targetZoneID)
	if zone == nil {
		return false, fmt.Sprintf("zone_not_found: %s", NormalizeZoneID(targetZoneID))
	}

	if !zone.IsUnlockedForPlayer(unlockedZones) {
		return false, "zone_locked"
	}

	return true, ""
}
