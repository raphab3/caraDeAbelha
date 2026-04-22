import { useEffect, useState } from "react";
import type { PlayerProgressState } from "../../types/game";
import { PlayerStatusPanel } from "./PlayerStatusPanel";

export interface ObjectivePanelProps {
  playerProgress: PlayerProgressState | undefined;
}

/**
 * ObjectivePanel displays player active context mapped to a sleek glassmorphic widget:
 * - Current zone name and status
 * - Available Skill Points (SP) when relevant
 * - Completely dropped redundant level/xp bars (now in ribbon) and bulky unlocked lists
 */
export const ObjectivePanel = ({ playerProgress }: ObjectivePanelProps) => {
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  // Zone name mapping (placeholder - would come from server in production)
  const zoneNames: Record<string, string> = {
    zone_0: "Prado de Flores",
    zone_1: "Bosque Central",
    zone_2: "Colmeia Rainha",
    zone_3: "Campos Selvagens",
    zone_4: "Caverna Profunda",
  };

  const getZoneName = (zoneId: string): string => {
    return zoneNames[zoneId] ?? `${zoneId}`;
  };

  useEffect(() => {
    if (!isStatusOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsStatusOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusOpen]);

  if (!playerProgress) return null;

  const currentZoneName = getZoneName(playerProgress.currentZoneId);

  return (
    <div className="flex flex-col gap-3 pointer-events-none pl-4 pt-2">
      {/* Current Zone Widget */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-xl p-2.5 pr-6 flex items-center gap-3.5 pointer-events-auto self-start">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-inner border border-emerald-300/50">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-emerald-300/90 uppercase tracking-widest mb-0.5 drop-shadow-sm">
            Mundo Atual
          </span>
          <span className="text-sm font-black text-white drop-shadow-md">
            {currentZoneName}
          </span>
        </div>
      </div>

      {/* Skill Points Indicator (Only shown if SP > 0 to save space) - Retained since SP isn't in ribbon */}
      {playerProgress.skillPoints > 0 && (
        <div className="bg-slate-900/70 backdrop-blur-md rounded-full border border-slate-700/60 shadow-lg px-4 py-2 flex items-center gap-2.5 self-start pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
            <span className="text-cyan-300 font-black text-sm">{playerProgress.skillPoints}</span> SP Disponíveis
          </span>
        </div>
      )}

      <button
        aria-controls="player-status-panel"
        aria-expanded={isStatusOpen}
        className="min-h-11 self-start rounded-full border border-slate-700/60 bg-slate-900/72 px-4 py-2.5 text-left shadow-lg backdrop-blur-md transition hover:border-cyan-300/60 hover:bg-slate-900/82 pointer-events-auto"
        onClick={() => {
          setIsStatusOpen((current) => !current);
        }}
        type="button"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 21a6 6 0 0 0-12 0" />
              <circle cx="12" cy="11" r="4" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/75">
              Jogador
            </span>
            <span className="text-sm font-black text-white">
              {isStatusOpen ? "Fechar status" : "Abrir status"}
            </span>
          </span>
        </span>
      </button>

      <div id="player-status-panel" className="pointer-events-auto self-start">
        <PlayerStatusPanel
          currentZoneName={currentZoneName}
          isOpen={isStatusOpen}
          onClose={() => {
            setIsStatusOpen(false);
          }}
          playerProgress={playerProgress}
        />
      </div>
    </div>
  );
};
