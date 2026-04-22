package progression

import (
	"testing"
)

// TestNewPlayerProgression verifies that new players are initialized correctly.
func TestNewPlayerProgression(t *testing.T) {
	playerID := "player_test_1"
	prog := NewPlayerProgression(playerID)

	if prog.PlayerID != playerID {
		t.Errorf("expected playerID %s, got %s", playerID, prog.PlayerID)
	}

	if prog.Level != 1 {
		t.Errorf("expected level 1, got %d", prog.Level)
	}

	if prog.XP != 0 {
		t.Errorf("expected XP 0, got %d", prog.XP)
	}

	if prog.SkillPoints != 1 {
		t.Errorf("expected skill points 1, got %d", prog.SkillPoints)
	}

	if len(prog.EquippedItems) != 0 {
		t.Errorf("expected no equipped items, got %d", len(prog.EquippedItems))
	}

	// Verify base attributes
	if prog.BaseAttributes.HP != 20 || prog.BaseAttributes.Damage != 5 || prog.BaseAttributes.Armor != 0 {
		t.Errorf("unexpected base attributes: %+v", prog.BaseAttributes)
	}

	// At level 1 with no equipment, derived should match base
	if prog.DerivedAttributes != prog.BaseAttributes {
		t.Errorf("derived attributes should match base at level 1: %+v vs %+v",
			prog.DerivedAttributes, prog.BaseAttributes)
	}
}

// TestInitializeProgression verifies InitializeProgression creates and stores progression.
func TestInitializeProgression(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_init_test"

	prog := service.InitializeProgression(playerID)

	if prog.PlayerID != playerID {
		t.Errorf("expected playerID %s, got %s", playerID, prog.PlayerID)
	}

	if prog.Level != 1 {
		t.Errorf("expected initial level 1, got %d", prog.Level)
	}

	// Verify it was stored
	retrieved, err := service.GetProgression(playerID)
	if err != nil {
		t.Errorf("expected to retrieve progression, got error: %v", err)
	}

	if retrieved.PlayerID != playerID {
		t.Errorf("retrieved progression has wrong playerID: %s", retrieved.PlayerID)
	}
}

// TestAddXPBasic tests adding XP and single level-up.
func TestAddXPBasic(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_xp_test_1"
	service.InitializeProgression(playerID)

	// Level 1 requires 100 XP, so adding 150 should level up
	leveledUp, newLevel, err := service.AddXP(playerID, 150)

	if err != nil {
		t.Fatalf("AddXP failed: %v", err)
	}

	if !leveledUp {
		t.Errorf("expected leveledUp=true, got false")
	}

	if newLevel != 2 {
		t.Errorf("expected level 2, got %d", newLevel)
	}

	// Verify progression state
	prog, _ := service.GetProgression(playerID)
	if prog.Level != 2 {
		t.Errorf("expected level 2 in progression, got %d", prog.Level)
	}

	if prog.SkillPoints != 2 {
		t.Errorf("expected skill points 2, got %d", prog.SkillPoints)
	}

	// 150 - 100 = 50 XP remaining
	if prog.XP != 50 {
		t.Errorf("expected XP 50, got %d", prog.XP)
	}
}

// TestAddXPMultipleLevelUps tests adding enough XP for multiple level-ups.
func TestAddXPMultipleLevelUps(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_xp_multi"
	service.InitializeProgression(playerID)

	// Level 1: 100 XP, Level 2: 200 XP, Level 3: 300 XP
	// Total: 100 + 200 = 300 XP to reach level 3
	// Adding 350 should reach level 3 with 50 XP overflow
	leveledUp, newLevel, err := service.AddXP(playerID, 350)

	if err != nil {
		t.Fatalf("AddXP failed: %v", err)
	}

	if !leveledUp {
		t.Errorf("expected leveledUp=true, got false")
	}

	if newLevel != 3 {
		t.Errorf("expected level 3, got %d", newLevel)
	}

	prog, _ := service.GetProgression(playerID)
	if prog.SkillPoints != 3 {
		t.Errorf("expected skill points 3, got %d", prog.SkillPoints)
	}

	// 350 - 100 - 200 = 50 XP overflow
	if prog.XP != 50 {
		t.Errorf("expected XP 50, got %d", prog.XP)
	}
}

// TestAddXPNoLevelUp tests adding XP without reaching next level.
func TestAddXPNoLevelUp(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_xp_no_level"
	service.InitializeProgression(playerID)

	// Level 1 requires 100 XP, adding 50 should not level up
	leveledUp, newLevel, err := service.AddXP(playerID, 50)

	if err != nil {
		t.Fatalf("AddXP failed: %v", err)
	}

	if leveledUp {
		t.Errorf("expected leveledUp=false, got true")
	}

	if newLevel != 1 {
		t.Errorf("expected level 1, got %d", newLevel)
	}

	prog, _ := service.GetProgression(playerID)
	if prog.XP != 50 {
		t.Errorf("expected XP 50, got %d", prog.XP)
	}

	if prog.SkillPoints != 1 {
		t.Errorf("expected skill points 1, got %d", prog.SkillPoints)
	}
}

// TestAddXPMaxLevel tests that XP addition is rejected at max level.
func TestAddXPMaxLevel(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_max_level"
	service.InitializeProgression(playerID)

	prog, _ := service.GetProgression(playerID)
	prog.Level = MaxLevel // Force to level 50

	leveledUp, newLevel, err := service.AddXP(playerID, 100)

	if err == nil {
		t.Errorf("expected error at max level, got nil")
	}

	if leveledUp {
		t.Errorf("expected leveledUp=false at max level, got true")
	}

	if newLevel != MaxLevel {
		t.Errorf("expected level %d, got %d", MaxLevel, newLevel)
	}
}

// TestAddXPCapAtMaxLevel tests that XP is capped when reaching max level.
func TestAddXPCapAtMaxLevel(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_cap_at_max"
	service.InitializeProgression(playerID)

	prog, _ := service.GetProgression(playerID)
	prog.Level = MaxLevel - 1
	prog.XP = 0

	// xpRequired for level 49→50 = 100 * 50 = 5000
	// Adding 6000 should level up to 50 and cap XP at 0
	leveledUp, newLevel, err := service.AddXP(playerID, 6000)

	if err != nil {
		t.Fatalf("AddXP failed: %v", err)
	}

	if !leveledUp {
		t.Errorf("expected leveledUp=true, got false")
	}

	if newLevel != MaxLevel {
		t.Errorf("expected level %d, got %d", MaxLevel, newLevel)
	}

	prog, _ = service.GetProgression(playerID)
	if prog.XP != 0 {
		t.Errorf("expected XP capped at 0 for max level, got %d", prog.XP)
	}
}

// TestAddXPPlayerNotFound tests AddXP with non-existent player.
func TestAddXPPlayerNotFound(t *testing.T) {
	service := NewProgressionService()

	leveledUp, newLevel, err := service.AddXP("nonexistent", 100)

	if err == nil {
		t.Errorf("expected error for non-existent player, got nil")
	}

	if leveledUp {
		t.Errorf("expected leveledUp=false for missing player, got true")
	}

	if newLevel != 0 {
		t.Errorf("expected level 0 for missing player, got %d", newLevel)
	}
}

// TestCalculateDerivedAttributesNoEquipment tests attribute calculation without equipment.
func TestCalculateDerivedAttributesNoEquipment(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_attrs_1"
	prog := service.InitializeProgression(playerID)

	// Level 1, no bonuses
	derived := service.CalculateDerivedAttributes(prog)

	expectedHP := uint32(20)
	expectedDamage := uint32(5)
	expectedArmor := uint32(0)

	if derived.HP != expectedHP {
		t.Errorf("level 1 HP: expected %d, got %d", expectedHP, derived.HP)
	}

	if derived.Damage != expectedDamage {
		t.Errorf("level 1 Damage: expected %d, got %d", expectedDamage, derived.Damage)
	}

	if derived.Armor != expectedArmor {
		t.Errorf("level 1 Armor: expected %d, got %d", expectedArmor, derived.Armor)
	}
}

// TestCalculateDerivedAttributesWithLevelBonus tests attribute calculation at higher levels.
func TestCalculateDerivedAttributesWithLevelBonus(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_attrs_2"
	prog := service.InitializeProgression(playerID)

	// Manually set to level 5 for testing
	prog.Level = 5

	derived := service.CalculateDerivedAttributes(prog)

	// Base: HP=20, Dmg=5, Armor=0
	// Level bonus: +2 HP, +1 Dmg per level (4 bonus levels for level 5)
	// Expected: HP=20+2*4=28, Dmg=5+1*4=9, Armor=0+0.5*4=2 (rounded down)
	expectedHP := uint32(28)
	expectedDamage := uint32(9)
	expectedArmor := uint32(2)

	if derived.HP != expectedHP {
		t.Errorf("level 5 HP: expected %d, got %d", expectedHP, derived.HP)
	}

	if derived.Damage != expectedDamage {
		t.Errorf("level 5 Damage: expected %d, got %d", expectedDamage, derived.Damage)
	}

	if derived.Armor != expectedArmor {
		t.Errorf("level 5 Armor: expected %d, got %d", expectedArmor, derived.Armor)
	}
}

// TestCalculateDerivedAttributesMaxLevel tests attribute calculation at max level.
func TestCalculateDerivedAttributesMaxLevel(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_attrs_max"
	prog := service.InitializeProgression(playerID)

	prog.Level = MaxLevel

	derived := service.CalculateDerivedAttributes(prog)

	// Base: HP=20, Dmg=5, Armor=0
	// Level bonus: +2 HP, +1 Dmg per level (49 bonus levels for level 50)
	// Expected: HP=20+2*49=118, Dmg=5+1*49=54, Armor=0+0.5*49=24 (rounded down)
	expectedHP := uint32(20 + 2*49)
	expectedDamage := uint32(5 + 1*49)
	expectedArmor := uint32((49) / 2)

	if derived.HP != expectedHP {
		t.Errorf("level 50 HP: expected %d, got %d", expectedHP, derived.HP)
	}

	if derived.Damage != expectedDamage {
		t.Errorf("level 50 Damage: expected %d, got %d", expectedDamage, derived.Damage)
	}

	if derived.Armor != expectedArmor {
		t.Errorf("level 50 Armor: expected %d, got %d", expectedArmor, derived.Armor)
	}
}

// TestCalculateDerivedAttributesNilProgression tests handling of nil progression.
func TestCalculateDerivedAttributesNilProgression(t *testing.T) {
	service := NewProgressionService()

	derived := service.CalculateDerivedAttributes(nil)

	if derived.HP != 0 || derived.Damage != 0 || derived.Armor != 0 {
		t.Errorf("expected zero attributes for nil progression, got %+v", derived)
	}
}

// TestGetProgression tests retrieving existing player progression.
func TestGetProgression(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_get_test"
	service.InitializeProgression(playerID)

	prog, err := service.GetProgression(playerID)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if prog.PlayerID != playerID {
		t.Errorf("expected playerID %s, got %s", playerID, prog.PlayerID)
	}
}

// TestGetProgressionNotFound tests retrieving non-existent player.
func TestGetProgressionNotFound(t *testing.T) {
	service := NewProgressionService()

	prog, err := service.GetProgression("nonexistent")

	if err == nil {
		t.Errorf("expected error for non-existent player, got nil")
	}

	if prog != nil {
		t.Errorf("expected nil progression for missing player, got %+v", prog)
	}
}

// TestSkillPointsAccumulation tests that skill points increase correctly over multiple level-ups.
func TestSkillPointsAccumulation(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_skill_points"
	service.InitializeProgression(playerID)

	// Each level grants 1 skill point
	// Starting: 1 skill point (level 1)
	// After 300 XP: level 3, should have 3 skill points

	service.AddXP(playerID, 300)

	prog, _ := service.GetProgression(playerID)

	if prog.Level != 3 {
		t.Errorf("expected level 3, got %d", prog.Level)
	}

	if prog.SkillPoints != 3 {
		t.Errorf("expected skill points 3, got %d", prog.SkillPoints)
	}
}

// TestXPRequiredForLevelFormula tests the XP calculation formula.
func TestXPRequiredForLevelFormula(t *testing.T) {
	tests := []struct {
		currentLevel uint32
		expectedXP   uint64
	}{
		{1, 100},   // Level 1 → 2 requires 100 XP
		{2, 200},   // Level 2 → 3 requires 200 XP
		{3, 300},   // Level 3 → 4 requires 300 XP
		{10, 1000}, // Level 10 → 11 requires 1000 XP
		{49, 4900}, // Level 49 → 50 requires 4900 XP
	}

	for _, test := range tests {
		xp := calculateXPRequiredForLevel(test.currentLevel)
		if xp != test.expectedXP {
			t.Errorf("calculateXPRequiredForLevel(%d): expected %d, got %d",
				test.currentLevel, test.expectedXP, xp)
		}
	}
}

// TestConcurrentAddXP tests thread-safety of AddXP.
func TestConcurrentAddXP(t *testing.T) {
	service := NewProgressionService()

	// Initialize 10 players
	for i := 0; i < 10; i++ {
		playerID := "player_concurrent_" + string(rune(48+i)) // "player_concurrent_0" etc.
		service.InitializeProgression(playerID)
	}

	// Add XP concurrently from multiple goroutines
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func(index int) {
			playerID := "player_concurrent_" + string(rune(48+index))
			service.AddXP(playerID, 300)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify all players reached level 3
	for i := 0; i < 10; i++ {
		playerID := "player_concurrent_" + string(rune(48+i))
		prog, err := service.GetProgression(playerID)
		if err != nil {
			t.Errorf("player %s not found: %v", playerID, err)
		}
		if prog.Level != 3 {
			t.Errorf("player %s: expected level 3, got %d", playerID, prog.Level)
		}
	}
}

// TestAddXPAccumulation tests adding XP in multiple increments.
func TestAddXPAccumulation(t *testing.T) {
	service := NewProgressionService()
	playerID := "player_accumulation"
	service.InitializeProgression(playerID)

	// Add 50 XP three times (total 150)
	// After first: 50 XP (no level-up)
	// After second: 100 XP (level-up to level 2, XP resets to 0)
	// After third: 50 XP (no level-up)
	service.AddXP(playerID, 50)
	leveledUp2, level2, _ := service.AddXP(playerID, 50)
	leveledUp3, level3, _ := service.AddXP(playerID, 50)

	// Check second call had level-up
	if !leveledUp2 {
		t.Errorf("expected level-up on second AddXP, got leveledUp=false")
	}

	if level2 != 2 {
		t.Errorf("expected level 2 after second add, got %d", level2)
	}

	// Third call should not level up
	if leveledUp3 {
		t.Errorf("expected no level-up on third AddXP, got leveledUp=true")
	}

	if level3 != 2 {
		t.Errorf("expected level 2 after third add, got %d", level3)
	}

	prog, _ := service.GetProgression(playerID)
	if prog.XP != 50 {
		t.Errorf("expected XP 50, got %d", prog.XP)
	}
}

// TestEquippedItemsInitial tests that new progression has empty equipped items.
func TestEquippedItemsInitial(t *testing.T) {
	prog := NewPlayerProgression("player_items")

	if len(prog.EquippedItems) != 0 {
		t.Errorf("expected empty equipped items map, got %d items", len(prog.EquippedItems))
	}
}

// TestAttributes tests that Attributes struct has correct fields.
func TestAttributes(t *testing.T) {
	attrs := Attributes{
		HP:     100,
		Damage: 50,
		Armor:  10,
	}

	if attrs.HP != 100 {
		t.Errorf("HP: expected 100, got %d", attrs.HP)
	}

	if attrs.Damage != 50 {
		t.Errorf("Damage: expected 50, got %d", attrs.Damage)
	}

	if attrs.Armor != 10 {
		t.Errorf("Armor: expected 10, got %d", attrs.Armor)
	}
}

// TestItemInstance tests ItemInstance struct creation and assignment.
func TestItemInstance(t *testing.T) {
	item := ItemInstance{
		ItemID: "sword_iron",
		Slot:   MAIN_HAND,
	}

	if item.ItemID != "sword_iron" {
		t.Errorf("ItemID: expected sword_iron, got %s", item.ItemID)
	}

	if item.Slot != MAIN_HAND {
		t.Errorf("Slot: expected %s, got %s", MAIN_HAND, item.Slot)
	}
}

// TestMultipleProgressions tests that multiple players can progress independently.
func TestMultipleProgressions(t *testing.T) {
	service := NewProgressionService()

	player1 := service.InitializeProgression("player_1")
	player2 := service.InitializeProgression("player_2")

	service.AddXP("player_1", 200) // player_1 → level 2
	service.AddXP("player_2", 400) // player_2 → level 3

	prog1, _ := service.GetProgression("player_1")
	prog2, _ := service.GetProgression("player_2")

	if prog1.Level != 2 {
		t.Errorf("player_1: expected level 2, got %d", prog1.Level)
	}

	if prog2.Level != 3 {
		t.Errorf("player_2: expected level 3, got %d", prog2.Level)
	}

	if player1.Level != 2 {
		t.Errorf("player_1 reference: expected level 2, got %d", player1.Level)
	}

	if player2.Level != 3 {
		t.Errorf("player_2 reference: expected level 3, got %d", player2.Level)
	}
}
