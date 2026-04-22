import type { InteractionResult, PlayerProgressState } from "../../types/game";
import { ResourceRibbon } from "./ResourceRibbon";
import { ObjectivePanel } from "./ObjectivePanel";
import { InteractionFeed } from "./InteractionFeed";

export interface GameHUDProps {
  playerProgress: PlayerProgressState | undefined;
  lastInteraction: InteractionResult | undefined;
}

/**
 * GameHUD is the top-level composition of all HUD layer components.
 * Layout:
 * - ResourceRibbon: top of screen (horizontal ribbon)
 * - ObjectivePanel: left side (card stack)
 * - InteractionFeed: center-bottom (alerts)
 */
export const GameHUD = ({ playerProgress, lastInteraction }: GameHUDProps) => {
  return (
    <>
      {/* Top Ribbon with Resources */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <ResourceRibbon playerProgress={playerProgress} lastInteraction={lastInteraction} />
      </div>

      {/* Left Panel with Objectives */}
      <div className="fixed left-0 top-20 z-30 pointer-events-auto">
        <ObjectivePanel playerProgress={playerProgress} />
      </div>

      {/* Center-Bottom Interaction Feed */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
        <InteractionFeed lastInteraction={lastInteraction} />
      </div>
    </>
  );
};
