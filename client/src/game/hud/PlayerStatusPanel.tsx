import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PlayerProgressState } from "../../types/game";

export interface PlayerStatusPanelProps {
  currentZoneName: string;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  playerProgress: PlayerProgressState;
}

interface FloatingPanelPosition {
  x: number;
  y: number;
}

const INITIAL_PANEL_POSITION: FloatingPanelPosition = {
  x: 16,
  y: 320,
};

function clampPanelPosition(position: FloatingPanelPosition, panel: HTMLElement | null): FloatingPanelPosition {
  if (typeof window === "undefined") {
    return position;
  }

  const panelWidth = panel?.offsetWidth ?? 352;
  const panelHeight = panel?.offsetHeight ?? 560;
  const maxX = Math.max(12, window.innerWidth - panelWidth - 12);
  const maxY = Math.max(12, window.innerHeight - panelHeight - 12);

  return {
    x: Math.min(Math.max(12, position.x), maxX),
    y: Math.min(Math.max(96, position.y), maxY),
  };
}

function getXpRequiredForLevel(level: number): number {
  return Math.max(level * 100, 100);
}

interface PlayerStatusPanelContentProps {
  currentZoneName: string;
  onDragStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  playerProgress: PlayerProgressState;
  onClose: () => void;
}

function PlayerStatusPanelContent({ currentZoneName, onClose, onDragStart, playerProgress }: PlayerStatusPanelContentProps) {
  const xpRequired = getXpRequiredForLevel(playerProgress.level);
  const xpProgress = Math.min((playerProgress.xp / xpRequired) * 100, 100);
  const pollenProgress = playerProgress.pollenCapacity > 0
    ? Math.min((playerProgress.pollenCarried / playerProgress.pollenCapacity) * 100, 100)
    : 0;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/70">Status</p>
          <h2 className="mt-2 text-xl font-black text-white">Sua abelha agora</h2>
          <p className="mt-1 text-sm text-slate-300">Resumo rápido de progresso, coleta e desbloqueios.</p>
        </div>

        <div className="flex items-center gap-2">
          {onDragStart ? (
            <button
              aria-label="Mover status do jogador"
              className="flex h-11 w-11 cursor-grab items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/70 text-slate-200 transition hover:border-cyan-300/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:cursor-grabbing"
              onPointerDown={onDragStart}
              type="button"
            >
              <span className="flex flex-col gap-1">
                <span className="h-0.5 w-4 rounded-full bg-current" />
                <span className="h-0.5 w-4 rounded-full bg-current" />
              </span>
            </button>
          ) : null}

          <button
            aria-label="Fechar status do jogador"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/70 text-slate-200 transition hover:border-cyan-300/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            onClick={onClose}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/16 via-slate-900/30 to-amber-500/12 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-amber-200/40 bg-gradient-to-b from-amber-400 to-amber-700 text-2xl font-black text-white shadow-inner">
            {playerProgress.level}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.26em] text-amber-100/80">Nível atual</span>
              <span className="text-sm font-semibold text-slate-300">XP {playerProgress.xp} / {xpRequired}</span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full border border-slate-700/80 bg-slate-950/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${xpProgress}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-300">Faltam {Math.max(xpRequired - playerProgress.xp, 0)} XP para o próximo nível.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <article className="rounded-[22px] border border-slate-800/90 bg-slate-900/72 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-yellow-200/70">Pólen</p>
          <p className="mt-2 text-2xl font-black text-white">{playerProgress.pollenCarried}<span className="ml-1 text-sm font-semibold text-slate-400">/ {playerProgress.pollenCapacity}</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500" style={{ width: `${pollenProgress}%` }} />
          </div>
        </article>

        <article className="rounded-[22px] border border-slate-800/90 bg-slate-900/72 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-200/70">Mel</p>
          <p className="mt-2 text-2xl font-black text-white">{playerProgress.honey}</p>
          <p className="mt-3 text-xs text-slate-400">Recurso usado para liberar novas áreas.</p>
        </article>

        <article className="rounded-[22px] border border-slate-800/90 bg-slate-900/72 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">SP livres</p>
          <p className="mt-2 text-2xl font-black text-white">{playerProgress.skillPoints}</p>
          <p className="mt-3 text-xs text-slate-400">Reservados para a futura árvore de habilidades.</p>
        </article>

        <article className="rounded-[22px] border border-slate-800/90 bg-slate-900/72 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">Áreas</p>
          <p className="mt-2 text-2xl font-black text-white">{playerProgress.unlockedZoneIds.length}</p>
          <p className="mt-3 text-xs text-slate-400">Biomas já desbloqueados na sua jornada.</p>
        </article>
      </div>

      <div className="mt-4 rounded-[24px] border border-slate-800 bg-slate-900/72 p-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">Mundo atual</p>
            <p className="mt-1 text-base font-bold text-white">{currentZoneName}</p>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">Ativo</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 text-sm text-slate-300">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Capacidade</p>
            <p className="mt-1 font-semibold text-white">{playerProgress.pollenCapacity} de pólen</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Ritmo</p>
            <p className="mt-1 font-semibold text-white">Lv. {playerProgress.level} em progresso</p>
          </div>
        </div>
      </div>
    </>
  );
}

export const PlayerStatusPanel = ({ currentZoneName, isMobile, isOpen, onClose, playerProgress }: PlayerStatusPanelProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  const dragOffsetRef = useRef<FloatingPanelPosition | null>(null);
  const [panelPosition, setPanelPosition] = useState<FloatingPanelPosition>(INITIAL_PANEL_POSITION);

  useEffect(() => {
    if (!isOpen || isMobile) {
      return undefined;
    }

    const handleResize = () => {
      setPanelPosition((current) => clampPanelPosition(current, panelRef.current));
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobile, isOpen]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isMobile) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    dragOffsetRef.current = {
      x: event.clientX - panelPosition.x,
      y: event.clientY - panelPosition.y,
    };

    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragOffsetRef.current) {
        return;
      }

      setPanelPosition(
        clampPanelPosition(
          {
            x: moveEvent.clientX - dragOffsetRef.current.x,
            y: moveEvent.clientY - dragOffsetRef.current.y,
          },
          panel,
        ),
      );
    };

    const handlePointerUp = () => {
      dragOffsetRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  if (!isOpen) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 md:hidden">
        <button
          aria-label="Fechar status do jogador"
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
          onClick={onClose}
          type="button"
        />

        <section
          aria-label="Status do jogador"
          aria-modal="true"
          className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[32px] border border-slate-700/70 bg-slate-950/95 p-4 pb-6 text-slate-50 shadow-[0_-24px_80px_rgba(15,23,42,0.56)] backdrop-blur-xl"
          role="dialog"
        >
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-700/90" />
          <PlayerStatusPanelContent
            currentZoneName={currentZoneName}
            onClose={onClose}
            playerProgress={playerProgress}
          />
        </section>
      </div>
    );
  }

  return (
    <section
      aria-label="Status do jogador"
      className="fixed z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[28px] border border-slate-700/70 bg-slate-950/88 p-4 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.48)] backdrop-blur-xl"
      ref={panelRef}
      role="dialog"
      style={{ left: `${panelPosition.x}px`, top: `${panelPosition.y}px` }}
    >
      <PlayerStatusPanelContent
        currentZoneName={currentZoneName}
        onClose={onClose}
        onDragStart={handlePointerDown}
        playerProgress={playerProgress}
      />
    </section>
  );
};