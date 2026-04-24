import { useEffect, useState } from "react";
import type { GameSessionController, PlayerProgressState } from "../../types/game";
import { PlayerStatusPanel } from "./PlayerStatusPanel";
import { SkillShopPanel } from "./SkillShopPanel";

export interface ObjectivePanelProps {
  gameSessionController: GameSessionController | undefined;
  isEditingSkills: boolean;
  isRecordingHotkeyForSlot: number | undefined;
  isShopOpen: boolean;
  onCloseShop: () => void;
  onSelectSkill: (skillId: string | undefined) => void;
  onRequestHotkeyCapture: (slot: number | undefined) => void;
  onToggleEditingSkills: () => void;
  onToggleShop: () => void;
  playerProgress: PlayerProgressState | undefined;
  selectedSkillId: string | undefined;
  slotHotkeys: string[];
}

/**
 * ObjectivePanel displays player active context mapped to a sleek glassmorphic widget:
 * - Current zone name and status
 * - Available Skill Points (SP) when relevant
 * - Completely dropped redundant level/xp bars (now in ribbon) and bulky unlocked lists
 */
export const ObjectivePanel = ({
  gameSessionController,
  isEditingSkills,
  isRecordingHotkeyForSlot,
  isShopOpen,
  onCloseShop,
  onRequestHotkeyCapture,
  onSelectSkill,
  onToggleEditingSkills,
  onToggleShop,
  playerProgress,
  selectedSkillId,
  slotHotkeys,
}: ObjectivePanelProps) => {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia("(max-width: 767px)").matches);

  // Zone name mapping (placeholder - would come from server in production)
  const zoneNames: Record<string, string> = {
    "zone:starter_meadow": "Starter Meadow",
    "zone:sunflower_ridge": "Sunflower Ridge",
  };

  const getZoneName = (zoneId: string): string => {
    return zoneNames[zoneId] ?? `${zoneId}`;
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "c") {
        event.preventDefault();
        setIsStatusOpen((current) => !current);
        return;
      }

      if (normalizedKey === "escape") {
        setIsStatusOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!playerProgress) return null;

  const currentZoneName = getZoneName(playerProgress.currentZoneId);

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-y-auto overscroll-contain pl-4 pr-2 pt-2 pb-28 pointer-events-none [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent]">
      {!isStatusOpen ? (
        <>
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
            aria-keyshortcuts="C"
            className="min-h-11 self-start rounded-full border border-slate-700/60 bg-slate-900/72 px-4 py-2.5 text-left shadow-lg backdrop-blur-md transition hover:border-cyan-300/60 hover:bg-slate-900/82 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 pointer-events-auto"
            onClick={() => {
              setIsStatusOpen(true);
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
                  Abrir status
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  tecla C
                </span>
              </span>
            </span>
          </button>

          <button
            aria-expanded={isShopOpen}
            aria-keyshortcuts="L"
            className="min-h-11 self-start rounded-full border border-slate-700/60 bg-slate-900/72 px-4 py-2.5 text-left shadow-lg backdrop-blur-md transition hover:border-amber-300/60 hover:bg-slate-900/82 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 pointer-events-auto"
            onClick={onToggleShop}
            type="button"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h16v14H4z" />
                  <path d="M6 8h12" />
                  <path d="M7 12h10" />
                  <path d="M8 16h8" />
                </svg>
              </span>
              <span className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-200/75">
                  Loja
                </span>
                <span className="text-sm font-black text-white">
                  {isShopOpen ? "Fechar skills" : "Abrir skills"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  tecla L
                </span>
              </span>
            </span>
          </button>
        </>
      ) : null}

      <div id="player-status-panel" className="pointer-events-auto self-start">
        <PlayerStatusPanel
          currentZoneName={currentZoneName}
          isMobile={isMobileViewport}
          isOpen={isStatusOpen}
          onClose={() => {
            setIsStatusOpen(false);
          }}
          playerProgress={playerProgress}
        />
      </div>

      {isShopOpen && !isStatusOpen ? (
        <div className="pointer-events-auto self-start">
          <SkillShopPanel
            gameSessionController={gameSessionController}
            isEditingSkills={isEditingSkills}
            isOpen={isShopOpen}
            isRecordingHotkeyForSlot={isRecordingHotkeyForSlot}
            onClose={onCloseShop}
            onRequestHotkeyCapture={onRequestHotkeyCapture}
            onSelectSkill={onSelectSkill}
            onToggleEditingSkills={onToggleEditingSkills}
            playerProgress={playerProgress}
            selectedSkillId={selectedSkillId}
            slotHotkeys={slotHotkeys}
          />
        </div>
      ) : null}
    </div>
  );
};
