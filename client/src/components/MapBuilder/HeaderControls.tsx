interface HeaderControlsProps {
  defaultY: number;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  mapName: string;
  mapSize: number;
  proceduralSeed: string;
  onDefaultYChange: (nextY: number) => void;
  onExportStage: () => void;
  onToggleFullscreen: () => void;
  onGenerateBase: () => void;
  onMapNameChange: (name: string) => void;
  onMapSizeChange: (size: number) => void;
  onProceduralSeedChange: (seed: string) => void;
}

export function HeaderControls({
  defaultY,
  isFullscreen,
  isFullscreenSupported,
  mapName,
  mapSize,
  proceduralSeed,
  onDefaultYChange,
  onExportStage,
  onToggleFullscreen,
  onGenerateBase,
  onMapNameChange,
  onMapSizeChange,
  onProceduralSeedChange,
}: HeaderControlsProps) {
  return (
    <section className="max-w-[980px] rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(15,23,42,0.72))] p-2.5 shadow-[0_12px_28px_rgba(2,6,23,0.32)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/72">Editor</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">Map Builder Pro</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {isFullscreenSupported ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-amber-200/30 hover:bg-white/10"
              onClick={onToggleFullscreen}
              type="button"
            >
              {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </button>
          ) : null}
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-emerald-200/30 hover:bg-white/10"
            onClick={onGenerateBase}
            type="button"
          >
            Gerar base
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/14 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20"
            onClick={onExportStage}
            type="button"
          >
            Exportar
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Nome</span>
          <input
            className="min-h-9 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
            onChange={(event) => onMapNameChange(event.target.value)}
            type="text"
            value={mapName}
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Seed</span>
          <input
            className="min-h-9 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
            onChange={(event) => onProceduralSeedChange(event.target.value)}
            type="text"
            value={proceduralSeed}
          />
        </label>

        <label className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Grid</span>
          <input
            className="min-h-9 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
            min={1}
            onChange={(event) => onMapSizeChange(Number(event.target.value))}
            step={1}
            type="number"
            value={mapSize}
          />
        </label>

        <label className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Altura Y</span>
          <input
            className="min-h-9 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
            onChange={(event) => onDefaultYChange(Number(event.target.value))}
            step={1}
            type="number"
            value={defaultY}
          />
        </label>
      </div>
    </section>
  );
}
