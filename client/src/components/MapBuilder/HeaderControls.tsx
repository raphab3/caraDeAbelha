import type { MapBuilderTool } from "./types";

interface HeaderControlsProps {
  currentTool: MapBuilderTool;
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
  onToolChange: (tool: MapBuilderTool) => void;
}

const TOOL_OPTIONS: Array<{ label: string; value: MapBuilderTool }> = [
  { label: "Pintar", value: "paint" },
  { label: "Selecionar", value: "select" },
  { label: "Deletar", value: "delete" },
];

function resolveToolButtonClassName(isActive: boolean): string {
  return [
    "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors",
    isActive
      ? "border-amber-300/45 bg-amber-300/16 text-amber-100"
      : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-200/20 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export function HeaderControls({
  currentTool,
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
  onToolChange,
}: HeaderControlsProps) {
  return (
    <section className="max-w-[920px] rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] p-2.5 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur-xl md:p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/72">Editor</p>
          <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">Map Builder Pro</h3>
          <p className="mt-1 text-sm leading-6 text-slate-300">Tudo fica sobre o mapa para voce editar sem sair do viewport.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isFullscreenSupported ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-amber-200/30 hover:bg-white/10"
              onClick={onToggleFullscreen}
              type="button"
            >
              {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </button>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-emerald-200/30 hover:bg-white/10"
            onClick={onGenerateBase}
            type="button"
          >
            Gerar base do mapa
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/14 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20"
            onClick={onExportStage}
            type="button"
          >
            Exportar mapa
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(170px,0.9fr)_100px_100px]">
          <label className="flex min-w-0 flex-col gap-1 rounded-[18px] border border-white/10 bg-black/20 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Nome</span>
            <input
              className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
              onChange={(event) => onMapNameChange(event.target.value)}
              type="text"
              value={mapName}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1 rounded-[18px] border border-white/10 bg-black/20 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Seed</span>
            <input
              className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
              onChange={(event) => onProceduralSeedChange(event.target.value)}
              type="text"
              value={proceduralSeed}
            />
          </label>

          <label className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-black/20 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Grid</span>
            <input
              className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
              min={1}
              onChange={(event) => onMapSizeChange(Number(event.target.value))}
              step={1}
              type="number"
              value={mapSize}
            />
          </label>

          <label className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-black/20 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Altura Y</span>
            <input
              className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
              onChange={(event) => onDefaultYChange(Number(event.target.value))}
              step={1}
              type="number"
              value={defaultY}
            />
          </label>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/20 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Ferramenta</p>
            {TOOL_OPTIONS.map((toolOption) => (
              <button
                key={toolOption.value}
                className={resolveToolButtonClassName(currentTool === toolOption.value)}
                onClick={() => onToolChange(toolOption.value)}
                type="button"
              >
                {toolOption.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Troque a ferramenta sem sair do viewport.
          </p>
        </div>
      </div>
    </section>
  );
}
