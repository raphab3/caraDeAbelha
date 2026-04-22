import { useEffect, useState } from "react";
import type { InteractionResult, PlayerProgressState } from "../../types/game";

export interface ResourceRibbonProps {
  playerProgress: PlayerProgressState | undefined;
  lastInteraction: InteractionResult | undefined;
}

/**
 * ResourceRibbon displays player resources in a top-of-screen ribbon:
 * - Pollen bar with current/max capacity
 * - Honey counter (numeric only)
 * - Level display
 * - XP progress bar
 * - Brief flash feedback on interaction (e.g., "+5 pollen", "+2 honey")
 */
export const ResourceRibbon = ({ playerProgress, lastInteraction }: ResourceRibbonProps) => {
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Show flash message on interaction
  useEffect(() => {
    if (!lastInteraction || !lastInteraction.success) {
      return;
    }

    let flashText = "";
    if (lastInteraction.action.includes("collect") || lastInteraction.action.includes("pollen")) {
      flashText = `+${lastInteraction.amount} pollen`;
    } else if (lastInteraction.action.includes("deposit") || lastInteraction.action.includes("honey")) {
      flashText = `+${lastInteraction.amount} honey`;
    } else {
      flashText = `+${lastInteraction.amount}`;
    }

    setFlashMessage(flashText);

    const timeoutId = window.setTimeout(() => {
      setFlashMessage(null);
    }, 1500); // Flash for 1.5 seconds

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastInteraction]);

  if (!playerProgress) {
    return (
      <div className="h-20 bg-yellow-900/30 border-b border-yellow-700/50 flex items-center justify-center">
        <span className="text-yellow-900 font-medium">Carregando progresso...</span>
      </div>
    );
  }

  const pollenPercent = (playerProgress.pollenCarried / playerProgress.pollenCapacity) * 100;
  // Estimate XP bar (assuming level progression)
  const xpPercent = (playerProgress.xp % 100); // Placeholder: 0-100 per level

  return (
    <div className="h-20 bg-yellow-900/20 border-b border-yellow-700/50 px-6 py-3 flex items-center justify-between gap-8">
      {/* Pollen Bar */}
      <div className="flex flex-col gap-1 min-w-48">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-yellow-900">Pollen</span>
          <span className="text-xs text-yellow-800">{playerProgress.pollenCarried}/{playerProgress.pollenCapacity}</span>
        </div>
        <div className="w-full h-4 bg-yellow-900/30 rounded border border-yellow-700/50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-300"
            style={{ width: `${pollenPercent}%` }}
          />
        </div>
      </div>

      {/* Honey Counter */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-yellow-900">Honey</span>
        <div className="text-2xl font-bold text-orange-600">{playerProgress.honey}</div>
      </div>

      {/* Level */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-yellow-900">Level</span>
        <div className="text-2xl font-bold text-amber-700">{playerProgress.level}</div>
      </div>

      {/* XP Bar */}
      <div className="flex flex-col gap-1 min-w-48">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-yellow-900">XP</span>
          <span className="text-xs text-yellow-800">{playerProgress.xp}</span>
        </div>
        <div className="w-full h-3 bg-yellow-900/30 rounded border border-yellow-700/50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-purple-500 transition-all duration-300"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      {/* Flash Feedback */}
      {flashMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 animate-pulse">
          <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-lg">
            {flashMessage}
          </div>
        </div>
      )}
    </div>
  );
};
