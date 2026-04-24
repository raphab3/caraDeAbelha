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
	ID        string
	Name      string
	Role      string
	Summary   string
	CostHoney int
}

var beeSkillCatalog = []beeSkillDefinition{
	{
		ID:        "skill:impulso",
		Name:      "Impulso",
		Role:      "mobilidade",
		Summary:   "Arrancada curta para reposicionar a abelha.",
		CostHoney: 40,
	},
	{
		ID:        "skill:atirar-ferrao",
		Name:      "Atirar Ferrão",
		Role:      "dano",
		Summary:   "Disparo ofensivo para a futura camada de combate.",
		CostHoney: 60,
	},
	{
		ID:        "skill:slime-de-mel",
		Name:      "Slime de Mel",
		Role:      "controle",
		Summary:   "Poça viscosa que prepara lentidão em inimigos.",
		CostHoney: 80,
	},
	{
		ID:        "skill:flor-de-nectar",
		Name:      "Flor de Néctar",
		Role:      "suporte",
		Summary:   "Broto de néctar para futura cura ou regeneração em área.",
		CostHoney: 100,
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
	switch skillID {
	case "skill:impulso":
		return 1800 * time.Millisecond
	case "skill:atirar-ferrao":
		return 2500 * time.Millisecond
	case "skill:slime-de-mel":
		return 6000 * time.Millisecond
	case "skill:flor-de-nectar":
		return 8000 * time.Millisecond
	default:
		return 2500 * time.Millisecond
	}
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
