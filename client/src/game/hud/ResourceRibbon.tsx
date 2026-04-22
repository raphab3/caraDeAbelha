import { useEffect, useState } from "react";
import type { FlowerInteractionState, InteractionResult, PlayerProgressState } from "../../types/game";

export interface ResourceRibbonProps {
  playerProgress: PlayerProgressState | undefined;
  lastInteraction: InteractionResult | undefined;
  flowerInteraction: FlowerInteractionState | undefined;
}

/**
 * ResourceRibbon displays player resources in a top-of-screen ribbon:
 * - Pollen bar with current/max capacity
 * - Honey counter (numeric only)
 * - Level display
 * - XP progress bar
 * - Brief flash feedback on interaction (e.g., "+5 pollen", "+2 honey")
 */
export const ResourceRibbon = ({ playerProgress, lastInteraction, flowerInteraction }: ResourceRibbonProps) => {
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"reward" | "xp">("reward");

  // Show flash message on interaction
  useEffect(() => {
    if (!lastInteraction || !lastInteraction.success) {
      return;
    }

    if (lastInteraction.reason.startsWith("Coletando flor")) {
      return;
    }

    let flashText = "";
    let nextTone: "reward" | "xp" = "reward";
    if (lastInteraction.action === "collect_flower" && lastInteraction.reason.includes("XP ganho")) {
      flashText = "XP ganho";
      nextTone = "xp";
    } else if (lastInteraction.action === "level_up") {
      flashText = `Nível ${lastInteraction.amount}`;
      nextTone = "xp";
    } else if (lastInteraction.action.includes("collect") || lastInteraction.action.includes("pollen")) {
      flashText = `+${lastInteraction.amount} pollen`;
    } else if (lastInteraction.action.includes("deposit") || lastInteraction.action.includes("honey")) {
      flashText = `+${lastInteraction.amount} honey`;
    } else {
      flashText = `+${lastInteraction.amount}`;
    }

    setFlashMessage(flashText);
    setFlashTone(nextTone);

    const timeoutId = window.setTimeout(() => {
      setFlashMessage(null);
    }, 1500); // Flash for 1.5 seconds

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastInteraction]);

  if (!playerProgress) {
    return (
      <div className="fixed top-4 left-4 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 shadow-xl flex items-center justify-center">
        <span className="text-amber-200 font-medium">Carregando progresso...</span>
      </div>
    );
  }

  const pollenPercent = (playerProgress.pollenCarried / playerProgress.pollenCapacity) * 100;
  // Estimate XP bar (assuming level progression)
  const xpPercent = (playerProgress.xp % 100); // Placeholder: 0-100 per level
  const flowerInteractionLabel =
    flowerInteraction?.phase === "collecting"
      ? "Coletando flor"
      : flowerInteraction
        ? "Indo coletar"
        : null;
  const flowerInteractionTone =
    flowerInteraction?.phase === "collecting"
      ? "from-emerald-500/90 to-lime-400/90 border-emerald-200/60 text-emerald-50"
      : "from-sky-500/90 to-cyan-400/90 border-sky-200/60 text-sky-50";

  return (
    <div className="px-4 py-4 flex items-start justify-between pointer-events-none">
      <div className="flex flex-wrap gap-4 items-start">
        {/* Level & XP Card */}
        <div className="flex bg-slate-900/70 backdrop-blur-md rounded-full items-center p-1.5 pr-5 border border-slate-700/60 shadow-xl pointer-events-auto">
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-b from-amber-400 to-amber-700 text-white font-black text-xl border-2 border-amber-200 shadow-inner">
            {playerProgress.level}
          </div>
          <div className="ml-3 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-amber-200 uppercase tracking-widest leading-none mb-1.5 drop-shadow-md">
              Nível {playerProgress.level}
            </span>
            <div className="w-28 h-2 bg-slate-950/80 rounded-full overflow-hidden border border-slate-700/80">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-300"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Resources Card */}
        <div className="flex bg-slate-900/70 backdrop-blur-md rounded-full items-center px-5 py-2.5 border border-slate-700/60 shadow-xl gap-5 pointer-events-auto">
          {/* Pollen */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-widest mb-1">Pólen</span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              <span className="text-base font-black text-white drop-shadow-md tracking-tight">
                {playerProgress.pollenCarried} <span className="text-xs font-semibold text-slate-400">/ {playerProgress.pollenCapacity}</span>
              </span>
            </div>
            <div className="w-full h-1 mt-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-300"
                style={{ width: `${pollenPercent}%` }}
              />
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/60" />
          
          {/* Honey */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-widest mb-1">Mel</span>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              <span className="text-base font-black text-white drop-shadow-md">{playerProgress.honey}</span>
            </div>
          </div>
        </div>
      </div>

      {flowerInteractionLabel ? (
        <div className="pointer-events-none flex items-start justify-end">
          <div
            className={`min-h-11 rounded-full border bg-gradient-to-r px-4 py-2 shadow-xl backdrop-blur-md ${flowerInteractionTone}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-90 animate-pulse" />
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">Flor alvo</span>
                <span className="mt-1 text-sm font-black">{flowerInteractionLabel}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Flash Feedback */}
      {flashMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 animate-bounce pointer-events-none">
          <div className={`text-white px-5 py-2 rounded-full font-black text-lg border-2 ${flashTone === "xp" ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 shadow-[0_4px_24px_rgba(168,85,247,0.45)] border-fuchsia-300/50" : "bg-gradient-to-r from-green-500 to-emerald-600 shadow-[0_4px_24px_rgba(16,185,129,0.5)] border-green-300/50"}`}>
            {flashMessage}
          </div>
        </div>
      )}
    </div>
  );
};
