import { useState } from "react";
import type { FlowerInteractionState, GameSessionController, InteractionResult, PlayerProgressState } from "../../types/game";
import { ResourceRibbon } from "./ResourceRibbon";
import { ObjectivePanel } from "./ObjectivePanel";
import { InteractionFeed } from "./InteractionFeed";
import { SkillLoadoutBar } from "./SkillLoadoutBar";
import { ZoneUnlockPanel } from "./ZoneUnlockPanel";
import styles from "./GameHUD.module.css";

export interface GameHUDProps {
  playerProgress: PlayerProgressState | undefined;
  lastInteraction: InteractionResult | undefined;
  flowerInteraction: FlowerInteractionState | undefined;
  gameSessionController: GameSessionController | undefined;
  lockedZoneId: string | undefined;
}

/**
 * GameHUD is the top-level composition of all HUD layer components.
 * Layout:
 * - ResourceRibbon: top of screen (z-40, horizontal ribbon)
 * - ObjectivePanel: left side (z-30, card stack)
 * - ZoneUnlockPanel: bottom-right (z-35, unlock dialog)
 * - InteractionFeed: center-bottom (z-20, alerts)
 */
export const GameHUD = ({
  playerProgress,
  lastInteraction,
  flowerInteraction,
  gameSessionController,
  lockedZoneId,
}: GameHUDProps) => {
  const [selectedSkillId, setSelectedSkillId] = useState<string | undefined>(undefined);

  return (
    <>
      {/* Top Ribbon with Resources */}
      <div className={styles.topRibbon}>
        <ResourceRibbon
          playerProgress={playerProgress}
          lastInteraction={lastInteraction}
          flowerInteraction={flowerInteraction}
        />
      </div>

      {/* Left Panel with Objectives */}
      <div className={styles.leftPanel}>
        <ObjectivePanel
          gameSessionController={gameSessionController}
          onSelectSkill={setSelectedSkillId}
          playerProgress={playerProgress}
          selectedSkillId={selectedSkillId}
        />
      </div>

      <div className={styles.bottomLoadout}>
        <SkillLoadoutBar
          gameSessionController={gameSessionController}
          onSelectSkill={setSelectedSkillId}
          playerProgress={playerProgress}
          selectedSkillId={selectedSkillId}
        />
      </div>

      {/* Zone Unlock Panel (bottom-right) */}
      <ZoneUnlockPanel
        playerProgress={playerProgress}
        gameSessionController={gameSessionController}
        lockedZoneId={lockedZoneId}
      />

      {/* Center-Bottom Interaction Feed */}
      <div className={styles.bottomFeed}>
        <InteractionFeed lastInteraction={lastInteraction} />
      </div>
    </>
  );
};
