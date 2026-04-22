import type { FlowerInteractionState, GameSessionController, InteractionResult, PlayerProgressState } from "../../types/game";
import { ResourceRibbon } from "./ResourceRibbon";
import { ObjectivePanel } from "./ObjectivePanel";
import { InteractionFeed } from "./InteractionFeed";
import { ZoneUnlockPanel } from "./ZoneUnlockPanel";

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
  return (
    <>
      {/* Top Ribbon with Resources */}
      <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
        <ResourceRibbon
          playerProgress={playerProgress}
          lastInteraction={lastInteraction}
          flowerInteraction={flowerInteraction}
        />
      </div>

      {/* Left Panel with Objectives */}
      <div className="absolute left-0 top-20 z-30 pointer-events-auto">
        <ObjectivePanel playerProgress={playerProgress} />
      </div>

      {/* Zone Unlock Panel (bottom-right) */}
      <ZoneUnlockPanel
        playerProgress={playerProgress}
        gameSessionController={gameSessionController}
        lockedZoneId={lockedZoneId}
      />

      {/* Center-Bottom Interaction Feed */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <InteractionFeed lastInteraction={lastInteraction} />
      </div>
    </>
  );
};
