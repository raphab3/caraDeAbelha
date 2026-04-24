import { DEFAULT_SKILL_CATALOG, SKILL_SLOT_COUNT } from "./skillCatalog";
import type { PlayerProgressState, PlayerStatusMessage, SkillCatalogEntry } from "../types/game";

function normalizeSkillCatalog(skillCatalog: SkillCatalogEntry[] | undefined): SkillCatalogEntry[] {
  if (!Array.isArray(skillCatalog) || skillCatalog.length === 0) {
    return DEFAULT_SKILL_CATALOG;
  }

  return skillCatalog;
}

function normalizeOwnedSkillIds(ownedSkillIds: string[] | undefined): string[] {
  if (!Array.isArray(ownedSkillIds)) {
    return [];
  }

  return ownedSkillIds.filter((skillId): skillId is string => typeof skillId === "string" && skillId.length > 0);
}

function normalizeEquippedSkills(equippedSkills: string[] | undefined, ownedSkillIds: string[]): string[] {
  const safeSlots = Array.from({ length: SKILL_SLOT_COUNT }, (_, index) => {
    const skillId = Array.isArray(equippedSkills) ? equippedSkills[index] : "";
    return typeof skillId === "string" && ownedSkillIds.includes(skillId) ? skillId : "";
  });

  return safeSlots;
}

export function normalizePlayerProgressState(playerProgress: PlayerProgressState): PlayerProgressState {
  const ownedSkillIds = normalizeOwnedSkillIds(playerProgress.ownedSkillIds);

  return {
    ...playerProgress,
    ownedSkillIds,
    equippedSkills: normalizeEquippedSkills(playerProgress.equippedSkills, ownedSkillIds),
    skillCatalog: normalizeSkillCatalog(playerProgress.skillCatalog),
  };
}

export function playerProgressFromStatus(message: PlayerStatusMessage): PlayerProgressState {
  return normalizePlayerProgressState({
    pollenCarried: message.pollenCarried,
    pollenCapacity: message.pollenCapacity,
    honey: message.honey,
    level: message.level,
    xp: message.xp,
    skillPoints: message.skillPoints,
    currentZoneId: message.currentZoneId,
    unlockedZoneIds: message.unlockedZoneIds,
    ownedSkillIds: message.ownedSkillIds,
    equippedSkills: message.equippedSkills,
    skillCatalog: message.skillCatalog,
  });
}