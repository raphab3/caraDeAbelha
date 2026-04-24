import type { SkillCatalogEntry } from "../types/game";

export const DEFAULT_SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    id: "skill:impulso",
    name: "Impulso",
    role: "mobilidade",
    summary: "Arrancada curta para reposicionar a abelha.",
    costHoney: 40,
  },
  {
    id: "skill:atirar-ferrao",
    name: "Atirar Ferrão",
    role: "dano",
    summary: "Disparo ofensivo para a futura camada de combate.",
    costHoney: 60,
  },
  {
    id: "skill:slime-de-mel",
    name: "Slime de Mel",
    role: "controle",
    summary: "Poça viscosa que prepara lentidão em inimigos.",
    costHoney: 80,
  },
  {
    id: "skill:flor-de-nectar",
    name: "Flor de Néctar",
    role: "suporte",
    summary: "Broto de néctar para futura cura ou regeneração em área.",
    costHoney: 100,
  },
];

export const SKILL_SLOT_COUNT = 4;