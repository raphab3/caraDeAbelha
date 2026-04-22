import type { MapBuilderTool } from "./types";

interface HeaderControlsProps {
  currentTool: MapBuilderTool;
  defaultY: number;
  mapName: string;
  mapSize: number;
  proceduralSeed: string;
  onDefaultYChange: (nextY: number) => void;
  onExportStage: () => void;
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
  mapName,
  mapSize,
  proceduralSeed,
  onDefaultYChange,
  onExportStage,
  onGenerateBase,
  onMapNameChange,
  onMapSizeChange,
  onProceduralSeedChange,
  onToolChange,
}: HeaderControlsProps) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.88),rgba(15,23,42,0.62))] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.3)] md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/72">Editor</p>
          <h3 className="mt-3 text-2xl font-semibold text-white md:text-3xl">Map Builder Pro</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Defina nome, seed e altura. Depois, escolha um item e monte o mapa.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-black/20 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Nome do mapa</span>
            <input
              className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
              onChange={(event) => onMapNameChange(event.target.value)}
              type="text"
              value={mapName}
            />
          </label>

          <label className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-black/20 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Seed</span>
            <input
              className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
              onChange={(event) => onProceduralSeedChange(event.target.value)}
              type="text"
              value={proceduralSeed}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Grid</span>
              <input
                className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
                min={1}
                onChange={(event) => onMapSizeChange(Number(event.target.value))}
                step={1}
                type="number"
                value={mapSize}
              />
            </label>

            <label className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Camada Y</span>
              <input
                className="min-h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/20"
                onChange={(event) => onDefaultYChange(Number(event.target.value))}
                step={1}
                type="number"
                value={defaultY}
              />
            </label>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Ferramenta ativa</p>
          <div className="mt-3 flex flex-wrap gap-2">
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
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Escolha uma ferramenta para pintar, selecionar ou apagar itens.
          </p>
        </div>
      </div>
    </section>
  );
}