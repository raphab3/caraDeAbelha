package progression

import (
	"fmt"
	"sync"
)

// ProgressionService manages player progression including XP, leveling, skill points,
// and attribute calculation with equipment modifiers.
//
// Server-Authoritative Design:
// All progression calculations happen on the server. The service:
// - Validates XP additions (no negative, no overflow)
// - Enforces max level (99) with no rollover
// - Calculates derived attributes deterministically
// - Prevents direct level/XP manipulation (only AddXP method modifies progression)
//
// Concurrency:
// Uses sync.RWMutex to protect the in-memory storage map.
// Multiple players can progress simultaneously without race conditions.
//
// Storage:
// In-memory map for now. Future: Replace with database for persistence.
// Map key: playerID, value: PlayerProgression pointer.
type ProgressionService struct {
	mu           sync.RWMutex
	progressions map[string]*PlayerProgression
}

// NewProgressionService creates and returns a new ProgressionService with empty storage.
func NewProgressionService() *ProgressionService {
	return &ProgressionService{
		progressions: make(map[string]*PlayerProgression),
	}
}

// XP and Leveling Math:
//
// Formula: xpRequiredForLevel = 100 * level
//
// Examples:
// - Level 1: Requires 100 XP total
// - Level 2: Requires 100 + 200 = 300 XP total
// - Level 3: Requires 100 + 200 + 300 = 600 XP total
// - Level N: xpForThisLevel = 100 * N
//
// Why this formula?
// - Simple, predictable progression curve
// - Gets harder as player levels up (quadratic growth)
// - Familiar from many RPGs (feels right to players)
//
// Max Level: 99
// - xpRequiredForLevel(99) = 100 * 99 = 9,900 XP for level 99 alone
// - Total XP to reach level 99: sum(100 * i) for i=1..98 = 485,100 XP
// - Prevents infinite progression; encourages alts and goal-setting
//
// Overflow Behavior:
// - Excess XP beyond level 99 is discarded (cap at max level)
// - No "overflow XP" mechanic (keeps accounting simple)

const (
	MaxLevel               = uint32(99)
	baseXPPerLevel         = uint64(100)
	basePollenCapacity     = uint32(40)
	pollenCapacityPerLevel = uint32(5)
)

// calculateXPRequiredForLevel computes the XP needed to advance to the next level.
// Formula: 100 * currentLevel
//
// Examples:
// - calculateXPRequiredForLevel(1) = 100 (player at level 1 needs 100 XP to reach level 2)
// - calculateXPRequiredForLevel(2) = 200 (player at level 2 needs 200 XP to reach level 3)
// - calculateXPRequiredForLevel(98) = 9800 (player at level 98 needs 9800 XP to reach level 99)
//
// Returns uint64 to prevent overflow when multiplying large level numbers.
func CalculateXPRequiredForLevel(currentLevel uint32) uint64 {
	return baseXPPerLevel * uint64(currentLevel)
}

func calculateXPRequiredForLevel(currentLevel uint32) uint64 {
	return CalculateXPRequiredForLevel(currentLevel)
}

func CalculatePollenCapacityForLevel(level uint32) int {
	if level <= 1 {
		return int(basePollenCapacity)
	}

	return int(basePollenCapacity + (level-1)*pollenCapacityPerLevel)
}

// AddXP adds the specified amount of XP to a player's progression.
//
// Parameters:
// - playerID: Player identifier
// - amount: XP to add (uint64, cannot be negative in type system)
//
// Returns:
// - leveledUp: true if player reached a new level during this call
// - newLevel: The level after adding XP (same as before if no level-up)
// - err: Non-nil if player not found, level already at max, or other error
//
// Behavior:
// 1. Validate player exists; return error if not found
// 2. Validate player is not already at max level (99)
// 3. Add XP to current XP pool
// 4. Check if accumulated XP exceeds next level threshold
// 5. If level-up: increment level, award skill point, reset XP pool, check for more level-ups
// 6. If at level 99 and still have excess XP: cap XP to 0 (prevent overflow)
// 7. Return leveledUp flag and new level
//
// Example Flow:
// Player at level 1 with 0 XP adds 150 XP:
// - xpRequiredForLevel(1) = 100
// - newXP = 0 + 150 = 150
// - 150 >= 100, so level up to level 2
// - skillPoints += 1 (now 2)
// - xp = 150 - 100 = 50 (overflow carries forward)
// - Check if 50 >= xpRequiredForLevel(2)=200: no, stop
// - Return leveledUp=true, newLevel=2
//
// Example with Multiple Level-Ups:
// Player at level 1 with 0 XP adds 400 XP:
// - Level 1→2: xpRequired=100, after: level=2, xp=300, skillPoints=2
// - Level 2→3: xpRequired=200, after: level=3, xp=100, skillPoints=3
// - xp=100 < xpRequired(3)=300, stop
// - Return leveledUp=true, newLevel=3
//
// Example at Max Level:
// Player at level 99 tries to add 100 XP:
// - Return leveledUp=false, newLevel=99, err="player already at max level"
func (s *ProgressionService) AddXP(playerID string, amount uint64) (leveledUp bool, newLevel uint32, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate player exists
	progression, exists := s.progressions[playerID]
	if !exists {
		return false, 0, fmt.Errorf("player not found: %s", playerID)
	}

	// Validate player not at max level
	if progression.Level >= MaxLevel {
		return false, progression.Level, fmt.Errorf("player already at max level (%d)", MaxLevel)
	}

	// Track if we leveled up during this call
	didLevelUp := false

	// Add XP and process level-ups in a loop
	progression.XP += amount

	for progression.Level < MaxLevel {
		xpRequired := calculateXPRequiredForLevel(progression.Level)

		// Check if we have enough XP to level up
		if progression.XP >= xpRequired {
			// Level up
			progression.XP -= xpRequired
			progression.Level++
			progression.SkillPoints++ // Award 1 skill point per level
			didLevelUp = true

			// Continue loop to check for additional level-ups
		} else {
			// Not enough XP for next level, stop
			break
		}
	}

	// Cap XP if at max level (no overflow)
	if progression.Level >= MaxLevel {
		progression.XP = 0
	}

	return didLevelUp, progression.Level, nil
}

// CalculateDerivedAttributes computes final character stats by combining base attributes,
// level bonuses, and equipment bonuses.
//
// Formula:
// DerivedStat = BaseStat + (LevelBonus * (Level - 1)) + EquipmentBonus
//
// - BaseStat: Starting stats (HP=20, Damage=5, Armor=0)
// - LevelBonus: Stats gained per level-up
//   - HP: +2 per level (level 5 = base 20 + 2*4 = 28 HP)
//   - Damage: +1 per level
//   - Armor: +0.5 per level (stored as uint32, so rounds down)
//
// - EquipmentBonus: Sum of stat modifiers from all equipped items
//
// Example:
// Base: HP=20, Dmg=5, Armor=0
// Level 5: HP += 2*4=8, Dmg += 1*4=4, Armor += 0*4=0 → HP=28, Dmg=9, Armor=0
// Sword equipped (HP+5, Dmg+3): HP=33, Dmg=12, Armor=0
//
// Why Equipment Bonus = 0?
// Equipment items are not yet defined (Epic 4 scope).
// For now, all items return {0, 0, 0} bonus.
// Future: Catalog will define bonus per item.
//
// Design Note:
// This method does NOT modify progression; it computes derived stats on-the-fly.
// Caller is responsible for storing result if needed.
// Server computes this once per state update and caches in DerivedAttributes.
func (s *ProgressionService) CalculateDerivedAttributes(progression *PlayerProgression) Attributes {
	if progression == nil {
		return Attributes{}
	}

	// Start with base attributes
	derived := progression.BaseAttributes

	// Apply level bonuses
	// Level 1 players get no level bonus (Level - 1 = 0)
	// Level 2 players get 1x level bonus
	// Level 99 players get 98x level bonus
	levelBonus := progression.Level - 1

	// HP: +2 per level
	derived.HP += uint32(levelBonus) * 2

	// Damage: +1 per level
	derived.Damage += uint32(levelBonus)

	// Armor: +0.5 per level (rounded down, so only every 2 levels visible)
	// For uint32, 0.5 per level means: divide total by 2
	derived.Armor += uint32(levelBonus) / 2

	// Apply equipment bonuses (for now, no items exist, so bonus is 0)
	// When items are introduced, sum equipment bonuses here:
	// for _, item := range progression.EquippedItems {
	//     bonus := getItemBonus(item.ItemID)
	//     derived.HP += bonus.HP
	//     derived.Damage += bonus.Damage
	//     derived.Armor += bonus.Armor
	// }

	return derived
}

// GetProgression retrieves a player's progression state.
//
// Returns:
// - *PlayerProgression: Pointer to the player's progression (or nil if not found)
// - error: Non-nil if player not found
//
// Thread-Safe:
// Uses RWMutex read lock to allow concurrent reads.
func (s *ProgressionService) GetProgression(playerID string) (*PlayerProgression, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	progression, exists := s.progressions[playerID]
	if !exists {
		return nil, fmt.Errorf("player progression not found: %s", playerID)
	}

	return progression, nil
}

// InitializeProgression creates a new player progression record.
//
// Parameters:
// - playerID: Player identifier
//
// Returns:
// - *PlayerProgression: Newly created progression state
//
// Behavior:
// - Creates a new PlayerProgression with Level=1, XP=0, SkillPoints=1
// - Stores in service's in-memory map
// - Returns pointer to created progression
//
// Idempotency:
// This method does NOT check for duplicates. Calling twice with same playerID
// will overwrite the previous progression. Caller is responsible for preventing
// duplicate initializations (e.g., check exists before calling).
//
// Thread-Safe:
// Uses write lock to protect map access.
//
// Example:
// service := NewProgressionService()
// prog := service.InitializeProgression("player_123")
// // prog.Level = 1, prog.SkillPoints = 1
func (s *ProgressionService) InitializeProgression(playerID string) *PlayerProgression {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Create new progression with factory function
	progression := NewPlayerProgression(playerID)

	// Store in service
	s.progressions[playerID] = progression

	return progression
}

// Helper method (not exported) to update derived attributes after any progression change.
// Used internally to keep DerivedAttributes in sync.
// In future, this could be called after AddXP, equipment changes, etc.
func (s *ProgressionService) updateDerivedAttributes(progression *PlayerProgression) {
	if progression != nil {
		progression.DerivedAttributes = s.CalculateDerivedAttributes(progression)
	}
}
