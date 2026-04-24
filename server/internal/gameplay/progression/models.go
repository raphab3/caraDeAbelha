package progression

// EquipmentSlot constants define the available equipment slots in the game.
// Each slot can hold at most one ItemInstance.
// Expansion slots (e.g., RING_1, RING_2 for dual rings) can be added later.
const (
	MAIN_HAND = "main_hand"
	ARMOR     = "armor"
)

// Attributes represents a set of character stats used both for base attributes and
// derived attributes (calculated from base + equipment bonuses).
//
// - HP (Hit Points): Current health pool. Determines survivability.
// - Damage: Physical or magical damage output. Affects combat effectiveness.
// - Armor: Damage reduction. Each point provides percentage mitigation (e.g., 10 armor = 10% reduction).
//
// These values are computed on the server for fairness.
// Server sends derived attributes to client for UI display (not used in combat yet).
type Attributes struct {
	HP     uint32 `json:"hp"`
	Damage uint32 `json:"damage"`
	Armor  uint32 `json:"armor"`
}

// ItemInstance represents a single equipped item with metadata.
//
// ItemID: References an item from a catalog (e.g., "sword_iron", "armor_leather").
//
//	Used to look up stat bonuses and visual properties.
//
// Slot: Which equipment slot this item occupies (e.g., "main_hand", "armor").
//
//	Must match one of the EQUIPMENT_SLOT constants.
//
// JSON Marshaling:
// - ItemID → itemId (camelCase)
// - Slot → slot (lowercase already)
type ItemInstance struct {
	ItemID string `json:"itemId"`
	Slot   string `json:"slot"`
}

// PlayerProgression tracks a player's advancement through levels, skill acquisition,
// and equipment management.
//
// Server-Authoritative:
// - All progression calculations happen on the server.
// - Client receives state snapshots; cannot directly modify XP or level.
// - Equipment changes are validated server-side before applying.
//
// XP System:
// - XP accumulates within a level: [0, xpRequiredForLevel).
// - xpRequiredForLevel = 100 * level (e.g., level 1 needs 100 XP, level 2 needs 200 more).
// - At level 99, no further leveling; excess XP is capped.
//
// Skill Points:
// - Awarded 1 point per level up (starting at level 1).
// - Available for skill tree allocation (implemented in a future system).
// - Never decreases (spent points tracked separately in skill tree).
//
// Attributes Derivation:
// Formula: DerivedAttribute = Base + LevelBonus + EquipmentBonus
// - Base: Set at initialization (fixed per player class/race, not yet implemented).
// - LevelBonus: Additional stats per level (e.g., +1 HP per level).
// - EquipmentBonus: Sum of bonuses from all equipped items.
//
// Example:
// - Player level 5, base HP=20, level bonus=+2 per level, equipped sword grants +5 HP
// - Derived HP = 20 + (5 * 2) + 5 = 35 HP
type PlayerProgression struct {
	// PlayerID uniquely identifies the player (e.g., UUID, username).
	PlayerID string `json:"playerId"`

	// XP: Experience points accumulated toward the current level.
	// Range: [0, xpRequiredForLevel) where xpRequiredForLevel = 100 * Level.
	XP uint64 `json:"xp"`

	// Level: Character level. Range: [1, 99].
	// Max level caps at 99; attempting to exceed this returns an error.
	Level uint32 `json:"level"`

	// SkillPoints: Unspent skill points available for allocation.
	// Incremented by 1 each level up.
	// Never decreases in this model (spent points tracked in skill tree separately).
	SkillPoints uint32 `json:"skillPoints"`

	// EquippedItems: Map of equipment slot → ItemInstance.
	// Key: Equipment slot name (e.g., "main_hand", "armor").
	// Value: The item currently equipped in that slot.
	// Empty slots are omitted from the map.
	// Server validates that ItemID exists in item catalog.
	EquippedItems map[string]ItemInstance `json:"equippedItems"`

	// BaseAttributes: Unmodified base stats before equipment bonuses.
	// Used as foundation for all attribute calculations.
	// In future: Can vary by class/race (currently all players start with same base).
	BaseAttributes Attributes `json:"baseAttributes"`

	// DerivedAttributes: Final stats after applying level and equipment bonuses.
	// Calculated by ProgressionService.CalculateDerivedAttributes().
	// Sent to client for UI/status displays.
	// NOT used for combat validation yet (future implementation).
	DerivedAttributes Attributes `json:"derivedAttributes"`
}

// NewPlayerProgression is a factory function that creates a new PlayerProgression
// with sensible defaults.
//
// Initialization:
// - Level: 1 (starting character)
// - XP: 0 (no progress yet)
// - SkillPoints: 1 (awarded for level 1)
// - EquippedItems: empty map (no gear equipped)
// - BaseAttributes: {HP: 20, Damage: 5, Armor: 0} (starting stats)
// - DerivedAttributes: Calculated from base (should match base at level 1 with no equipment)
//
// Design Note:
// We use a factory function instead of Go's zero value to enforce invariants.
// This prevents accidentally creating invalid progression states.
func NewPlayerProgression(playerID string) *PlayerProgression {
	// Level 1 starting attributes
	baseAttrs := Attributes{
		HP:     20,
		Damage: 5,
		Armor:  0,
	}

	// Derived attributes start as copy of base (no bonuses yet)
	derivedAttrs := baseAttrs

	progression := &PlayerProgression{
		PlayerID:          playerID,
		XP:                0,
		Level:             1,
		SkillPoints:       1, // 1 point awarded at level 1
		EquippedItems:     make(map[string]ItemInstance),
		BaseAttributes:    baseAttrs,
		DerivedAttributes: derivedAttrs,
	}

	return progression
}
