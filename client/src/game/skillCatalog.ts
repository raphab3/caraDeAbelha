import type { SkillCatalogEntry } from "../types/game";

export const DEFAULT_SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    id: "skill:impulso",
    name: "Impulso",
    role: "mobilidade",
    summary: "Arrancada curta para reposicionar a abelha.",
    costHoney: 40,
    baseCooldownMs: 1800,
    basePower: 0,
    baseDistance: 1.8,
    maxUpgradeLevel: 3,
  },
  {
    id: "skill:atirar-ferrao",
    name: "Atirar Ferrão",
    role: "dano",
    summary: "Disparo ofensivo para a futura camada de combate.",
    costHoney: 60,
    baseCooldownMs: 2500,
    basePower: 1,
    baseDistance: 4.2,
    maxUpgradeLevel: 3,
  },
  {
    id: "skill:slime-de-mel",
    name: "Slime de Mel",
    role: "controle",
    summary: "Poça viscosa que prepara lentidão em inimigos.",
    costHoney: 80,
    baseCooldownMs: 6000,
    basePower: 1,
    baseDistance: 0,
    maxUpgradeLevel: 3,
  },
  {
    id: "skill:flor-de-nectar",
    name: "Flor de Néctar",
    role: "suporte",
    summary: "Broto de néctar para futura cura ou regeneração em área.",
    costHoney: 100,
    baseCooldownMs: 8000,
    basePower: 1,
    baseDistance: 0,
    maxUpgradeLevel: 3,
  },
];

export const SKILL_SLOT_COUNT = 4;