import { useEffect, useState } from "react";

import { DEFAULT_SKILL_CATALOG, SKILL_SLOT_COUNT } from "../game/skillCatalog";
import type { InteractionResult, PlayerProgressState, PlayerStatusMessage } from "../types/game";

/**
 * useGameProgress manages local player progress state including pollen/honey inventory
 * and ephemeral interaction feedback. This hook does NOT duplicate server state but only
 * extends it with local UI concerns.
 *
 * @returns Object with progress state and update handlers
 */
export function useGameProgress() {
  const [progress, setProgress] = useState<PlayerProgressState | undefined>(undefined);
  const [lastInteraction, setLastInteraction] = useState<InteractionResult | undefined>(undefined);

  // Update progress from player_status message from server
  const updateFromMessage = (message: PlayerStatusMessage | InteractionResult) => {
    if (message.type === "player_status") {
      setProgress({
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
      return;
    }

    if (message.type === "interaction_result") {
      setLastInteraction(message);
      return;
    }
  };

  // Clear old interaction feedback after 3 seconds
  useEffect(() => {
    if (!lastInteraction) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLastInteraction(undefined);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastInteraction]);

  return {
    progress: progress ?? {
      pollenCarried: 0,
      pollenCapacity: 40,
      honey: 0,
      level: 1,
      xp: 0,
      skillPoints: 0,
      currentZoneId: "zone:starter_meadow",
      unlockedZoneIds: ["zone:starter_meadow"],
      ownedSkillIds: [],
      equippedSkills: Array.from({ length: SKILL_SLOT_COUNT }, () => ""),
      skillCatalog: DEFAULT_SKILL_CATALOG,
    },
    lastInteraction,
    updateFromMessage,
  };
}
