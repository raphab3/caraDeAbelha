import { DEFAULT_SKILL_CATALOG, SKILL_SLOT_COUNT } from "./skillCatalog";
import type { PlayerProgressState, PlayerSkillRuntimeState, PlayerStatusMessage, SkillCatalogEntry, SkillUpgradeState } from "../types/game";

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

function normalizeSkillRuntime(skillRuntime: PlayerSkillRuntimeState[] | undefined, equippedSkills: string[]): PlayerSkillRuntimeState[] {
  return Array.from({ length: SKILL_SLOT_COUNT }, (_, slot) => {
    const runtimeEntry = Array.isArray(skillRuntime) ? skillRuntime.find((entry) => entry.slot === slot) : undefined;
    const skillId = equippedSkills[slot] ?? "";
    const cooldownEndsAt = typeof runtimeEntry?.cooldownEndsAt === "number" ? runtimeEntry.cooldownEndsAt : 0;
    const isCooldown = runtimeEntry?.state === "cooldown" && cooldownEndsAt > Date.now() && runtimeEntry.skillId === skillId;

    return {
      slot,
      skillId,
      state: isCooldown ? "cooldown" : "ready",
      cooldownEndsAt: isCooldown ? cooldownEndsAt : 0,
    };
  });
}

function normalizeSkillUpgrades(
  skillUpgrades: SkillUpgradeState[] | undefined,
  ownedSkillIds: string[],
  skillCatalog: SkillCatalogEntry[],
): SkillUpgradeState[] {
  return ownedSkillIds.map((skillId) => {
    const entry = Array.isArray(skillUpgrades) ? skillUpgrades.find((current) => current.skillId === skillId) : undefined;
    const catalogEntry = skillCatalog.find((current) => current.id === skillId);

    return {
      skillId,
      level: typeof entry?.level === "number" ? entry.level : 0,
      maxLevel: typeof entry?.maxLevel === "number" ? entry.maxLevel : (catalogEntry?.maxUpgradeLevel ?? 0),
      currentCooldownMs: typeof entry?.currentCooldownMs === "number" ? entry.currentCooldownMs : (catalogEntry?.baseCooldownMs ?? 0),
      currentPower: typeof entry?.currentPower === "number" ? entry.currentPower : (catalogEntry?.basePower ?? 1),
      currentDistance: typeof entry?.currentDistance === "number" ? entry.currentDistance : (catalogEntry?.baseDistance ?? 0),
      nextCooldownMs: typeof entry?.nextCooldownMs === "number" ? entry.nextCooldownMs : (catalogEntry?.baseCooldownMs ?? 0),
      nextPower: typeof entry?.nextPower === "number" ? entry.nextPower : (catalogEntry?.basePower ?? 1),
      nextDistance: typeof entry?.nextDistance === "number" ? entry.nextDistance : (catalogEntry?.baseDistance ?? 0),
      nextUpgradeCost: typeof entry?.nextUpgradeCost === "number" ? entry.nextUpgradeCost : 0,
      canUpgrade: typeof entry?.canUpgrade === "boolean" ? entry.canUpgrade : false,
    };
  });
}

export function normalizePlayerProgressState(playerProgress: PlayerProgressState): PlayerProgressState {
  const ownedSkillIds = normalizeOwnedSkillIds(playerProgress.ownedSkillIds);
  const equippedSkills = normalizeEquippedSkills(playerProgress.equippedSkills, ownedSkillIds);
  const skillCatalog = normalizeSkillCatalog(playerProgress.skillCatalog);

  return {
    ...playerProgress,
    ownedSkillIds,
    equippedSkills,
    skillUpgrades: normalizeSkillUpgrades(playerProgress.skillUpgrades, ownedSkillIds, skillCatalog),
    skillRuntime: normalizeSkillRuntime(playerProgress.skillRuntime, equippedSkills),
    skillCatalog,
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
    skillUpgrades: message.skillUpgrades,
    skillRuntime: message.skillRuntime,
    skillCatalog: message.skillCatalog,
  });
}