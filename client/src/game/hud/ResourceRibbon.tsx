import { useEffect, useState } from "react";
import type { FlowerInteractionState, InteractionResult, PlayerProgressState } from "../../types/game";
import styles from "./ResourceRibbon.module.css";

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
      <div className={styles.loading}>
        <span className={styles.loadingText}>Carregando progresso...</span>
      </div>
    );
  }

  const pollenPercent = playerProgress.pollenCapacity > 0 ? (playerProgress.pollenCarried / playerProgress.pollenCapacity) * 100 : 0;
  const lifePercent = playerProgress.maxLife > 0 ? (playerProgress.currentLife / playerProgress.maxLife) * 100 : 0;
  const respawnSeconds =
    playerProgress.isDead && playerProgress.respawnEndsAt
      ? Math.max(0, Math.ceil((playerProgress.respawnEndsAt - Date.now()) / 1000))
      : 0;
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
      ? styles.flowerCollecting
      : styles.flowerTargeting;

  return (
    <div className={styles.root}>
      <div className={styles.groups}>
        {/* Level & XP Card */}
        <div className={[styles.pill, styles.levelPill].join(" ")}>
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
        <div className={[styles.pill, styles.resourcePill].join(" ")}>
          <div className={styles.vitalBlock}>
            <span className={styles.vitalLabel}>Vida</span>
            <div className={styles.vitalValue}>
              {playerProgress.currentLife}
              <span>/ {playerProgress.maxLife}</span>
            </div>
            <div className={styles.lifeTrack}>
              <div className={styles.lifeFill} style={{ width: `${lifePercent}%` }} />
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700/60" />

          {/* Pollen */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-widest mb-1">Energia (Pólen)</span>
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
        <div className={styles.flowerStatusWrap}>
          <div
            className={[styles.flowerStatus, flowerInteractionTone].join(" ")}
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

      {playerProgress.isDead ? (
        <div className={styles.respawnWrap}>
          <div className={styles.respawnStatus} role="status" aria-live="assertive">
            <span>Abelha abatida</span>
            <strong>Respawn em {respawnSeconds}s</strong>
          </div>
        </div>
      ) : null}

      {/* Flash Feedback */}
      {flashMessage && (
        <div className={styles.flashWrap}>
          <div className={[styles.flash, flashTone === "xp" ? styles.flashXp : styles.flashReward].join(" ")}>
            {flashMessage}
          </div>
        </div>
      )}
    </div>
  );
};
