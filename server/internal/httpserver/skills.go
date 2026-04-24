package httpserver

import (
	"time"

	"github.com/raphab33/cara-de-abelha/server/internal/gameplay/loopbase"
)

const skillSlotCount = 4

const (
	skillStateReady    = "ready"
	skillStateCooldown = "cooldown"
)

type beeSkillDefinition struct {
	ID                  string
	Name                string
	Role                string
	Summary             string
	CostHoney           int
	BaseCooldownMs      int
	BasePower           float64
	BaseDistance        float64
	MaxUpgradeLevel     int
	UpgradeCostBase     int
	UpgradeCostStep     int
	CooldownStepPercent float64
	PowerStep           float64
	DistanceStep        float64
}

var beeSkillCatalog = []beeSkillDefinition{
	{
		ID:                  "skill:impulso",
		Name:                "Impulso",
		Role:                "mobilidade",
		Summary:             "Arrancada curta para reposicionar a abelha.",
		CostHoney:           40,
		BaseCooldownMs:      1800,
		BasePower:           0,
		BaseDistance:        impulsoDashDistance,
		MaxUpgradeLevel:     3,
		UpgradeCostBase:     35,
		UpgradeCostStep:     25,
		CooldownStepPercent: 0.12,
		PowerStep:           0,
		DistanceStep:        0.35,
	},
	{
		ID:                  "skill:atirar-ferrao",
		Name:                "Atirar Ferrão",
		Role:                "dano",
		Summary:             "Disparo ofensivo para a futura camada de combate.",
		CostHoney:           60,
		BaseCooldownMs:      2500,
		BasePower:           1,
		BaseDistance:        ferraoProjectileDistance,
		MaxUpgradeLevel:     3,
		UpgradeCostBase:     45,
		UpgradeCostStep:     30,
		CooldownStepPercent: 0.10,
		PowerStep:           0.22,
		DistanceStep:        0.75,
	},
	{
		ID:                  "skill:slime-de-mel",
		Name:                "Slime de Mel",
		Role:                "controle",
		Summary:             "Poça viscosa que prepara lentidão em inimigos.",
		CostHoney:           80,
		BaseCooldownMs:      6000,
		BasePower:           1,
		BaseDistance:        0,
		MaxUpgradeLevel:     3,
		UpgradeCostBase:     60,
		UpgradeCostStep:     40,
		CooldownStepPercent: 0.08,
		PowerStep:           0.20,
		DistanceStep:        0,
	},
	{
		ID:                  "skill:flor-de-nectar",
		Name:                "Flor de Néctar",
		Role:                "suporte",
		Summary:             "Broto de néctar para futura cura ou regeneração em área.",
		CostHoney:           100,
		BaseCooldownMs:      8000,
		BasePower:           1,
		BaseDistance:        0,
		MaxUpgradeLevel:     3,
		UpgradeCostBase:     75,
		UpgradeCostStep:     50,
		CooldownStepPercent: 0.08,
		PowerStep:           0.24,
		DistanceStep:        0,
	},
}

func listBeeSkillCatalog() []beeSkillDefinition {
	cloned := make([]beeSkillDefinition, len(beeSkillCatalog))
	copy(cloned, beeSkillCatalog)
	return cloned
}

func findBeeSkillDefinition(skillID string) (beeSkillDefinition, bool) {
	for _, entry := range beeSkillCatalog {
		if entry.ID == skillID {
			return entry, true
		}
	}

	return beeSkillDefinition{}, false
}

func normalizeOwnedSkillIDs(skillIDs []string) []string {
	if len(skillIDs) == 0 {
		return []string{}
	}

	known := make(map[string]struct{}, len(beeSkillCatalog))
	for _, entry := range beeSkillCatalog {
		known[entry.ID] = struct{}{}
	}

	seen := make(map[string]struct{}, len(skillIDs))
	normalized := make([]string, 0, len(skillIDs))
	for _, skillID := range skillIDs {
		if _, ok := known[skillID]; !ok {
			continue
		}
		if _, duplicate := seen[skillID]; duplicate {
			continue
		}
		seen[skillID] = struct{}{}
		normalized = append(normalized, skillID)
	}

	return normalized
}

func normalizeEquippedSkills(skillSlots []string, ownedSkillIDs []string) []string {
	owned := make(map[string]struct{}, len(ownedSkillIDs))
	for _, skillID := range normalizeOwnedSkillIDs(ownedSkillIDs) {
		owned[skillID] = struct{}{}
	}

	normalized := make([]string, skillSlotCount)
	for index := 0; index < skillSlotCount; index++ {
		if index >= len(skillSlots) {
			continue
		}

		skillID := skillSlots[index]
		if _, ok := owned[skillID]; !ok {
			continue
		}

		normalized[index] = skillID
	}

	return normalized
}

func skillCooldownForSkill(skillID string) time.Duration {
	return skillCooldownForSkillLevel(skillID, 0)
}

func normalizeSkillUpgradeLevels(skillUpgradeLevels map[string]int, ownedSkillIDs []string) map[string]int {
	normalized := make(map[string]int)
	owned := make(map[string]struct{}, len(ownedSkillIDs))
	for _, skillID := range normalizeOwnedSkillIDs(ownedSkillIDs) {
		owned[skillID] = struct{}{}
	}

	for _, definition := range beeSkillCatalog {
		if _, ok := owned[definition.ID]; !ok {
			continue
		}
		level := 0
		if skillUpgradeLevels != nil {
			level = skillUpgradeLevels[definition.ID]
		}
		if level < 0 {
			level = 0
		}
		if level > definition.MaxUpgradeLevel {
			level = definition.MaxUpgradeLevel
		}
		normalized[definition.ID] = level
	}

	return normalized
}

func skillUpgradeLevel(skillUpgradeLevels map[string]int, skillID string) int {
	if skillUpgradeLevels == nil {
		return 0
	}
	level := skillUpgradeLevels[skillID]
	if level < 0 {
		return 0
	}
	return level
}

func skillCooldownForSkillLevel(skillID string, level int) time.Duration {
	definition, ok := findBeeSkillDefinition(skillID)
	if !ok {
		return 2500 * time.Millisecond
	}
	if level < 0 {
		level = 0
	}
	if level > definition.MaxUpgradeLevel {
		level = definition.MaxUpgradeLevel
	}
	reductionMultiplier := 1 - float64(level)*definition.CooldownStepPercent
	if reductionMultiplier < 0.45 {
		reductionMultiplier = 0.45
	}
	return time.Duration(float64(definition.BaseCooldownMs)*reductionMultiplier) * time.Millisecond
}

func skillPowerForLevel(skillID string, level int) float64 {
	definition, ok := findBeeSkillDefinition(skillID)
	if !ok {
		return 0
	}
	if level < 0 {
		level = 0
	}
	if level > definition.MaxUpgradeLevel {
		level = definition.MaxUpgradeLevel
	}
	return definition.BasePower + float64(level)*definition.PowerStep
}

func skillDistanceForLevel(skillID string, level int) float64 {
	definition, ok := findBeeSkillDefinition(skillID)
	if !ok {
		return 0
	}
	if level < 0 {
		level = 0
	}
	if level > definition.MaxUpgradeLevel {
		level = definition.MaxUpgradeLevel
	}
	return definition.BaseDistance + float64(level)*definition.DistanceStep
}

func nextSkillUpgradeCost(skillID string, level int) (int, bool) {
	definition, ok := findBeeSkillDefinition(skillID)
	if !ok {
		return 0, false
	}
	if level < 0 {
		level = 0
	}
	if level >= definition.MaxUpgradeLevel {
		return 0, false
	}
	return definition.UpgradeCostBase + level*definition.UpgradeCostStep, true
}

func normalizeSkillRuntime(skillRuntime []loopbase.PlayerSkillRuntime, equippedSkills []string, now time.Time) []loopbase.PlayerSkillRuntime {
	normalized := make([]loopbase.PlayerSkillRuntime, 0, skillSlotCount)
	for slot := 0; slot < skillSlotCount; slot++ {
		skillID := ""
		if slot < len(equippedSkills) {
			skillID = equippedSkills[slot]
		}

		entry := loopbase.PlayerSkillRuntime{
			Slot:    slot,
			SkillID: skillID,
			State:   skillStateReady,
		}

		if slot < len(skillRuntime) {
			current := skillRuntime[slot]
			if current.SkillID == skillID && !current.CooldownEndsAt.IsZero() && current.CooldownEndsAt.After(now) {
				entry.State = skillStateCooldown
				entry.CooldownEndsAt = current.CooldownEndsAt
			}
		}

		normalized = append(normalized, entry)
	}

	return normalized
}
