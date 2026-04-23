import { getMapBuilderCatalogItem } from "./catalog";
import type { HoveredGridCell, MapBuilderTool, MapStats, PlacedItem } from "./types";

interface SelectionInspectorProps {
  currentTool: MapBuilderTool;
  defaultY: number;
  hoveredCell: HoveredGridCell | null;
  mapName: string;
  onDeleteSelectedItem: () => void;
  onRotateQuarterTurn: (deltaDegrees: number) => void;
  onScaleChange: (scale: number) => void;
  onTagChange: (tag: string) => void;
  onZoneIdChange: (zoneId: string) => void;
  placedItemsCount: number;
  selectedAssetLabel: string | null;
  selectedItem: PlacedItem | null;
  selectedItemId: string | null;
  stats: MapStats;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export function SelectionInspector({
  currentTool,
  defaultY,
  hoveredCell,
  mapName,
  onDeleteSelectedItem,
  onRotateQuarterTurn,
  onScaleChange,
  onTagChange,
  onZoneIdChange,
  placedItemsCount,
  selectedAssetLabel,
  selectedItem,
  selectedItemId,
  stats,
}: SelectionInspectorProps) {
  const selectedCatalogItem = selectedItem ? getMapBuilderCatalogItem(selectedItem.prefabId) : null;
  const showTagField = Boolean(selectedItem && (selectedCatalogItem?.defaultTag || selectedItem.tag));
  const showZoneField = Boolean(selectedItem && selectedCatalogItem?.category !== "terrain");

  return (
    <aside className="w-full max-w-[320px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/84 shadow-[0_18px_44px_rgba(2,6,23,0.34)] backdrop-blur-xl">
      <div className="max-h-[min(52vh,560px)] overflow-y-auto p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/78">Detalhes</p>
        <h4 className="mt-2 text-base font-semibold text-white">{selectedItemId ? "Item selecionado" : "Resumo do mapa"}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-300">
          {selectedItemId
            ? "Ajuste o item sem sair do mapa."
            : "Escolha um item e clique no mapa para posicionar."}
        </p>

        <div className="mt-3 grid gap-2">
          <MetricRow label="Mapa" value={mapName || "Novo Stage"} />
          <MetricRow label="Ferramenta" value={currentTool} />
          <MetricRow label="Altura (Y)" value={defaultY.toString()} />
          <MetricRow label="Item ativo" value={selectedItem ? selectedCatalogItem?.label ?? selectedItem.prefabId : selectedAssetLabel ?? "Nenhum"} />
          <MetricRow label="Itens" value={placedItemsCount.toString()} />
          <MetricRow
            label="Cursor"
            value={hoveredCell ? `${hoveredCell.x}, ${hoveredCell.y}, ${hoveredCell.z}` : "Passe no mapa"}
          />
        </div>

        {selectedItem ? (
          <div className="mt-3 rounded-[20px] border border-amber-300/18 bg-amber-300/8 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">Edicao fina</p>
            <div className="mt-3 grid gap-2">
              <MetricRow label="ID" value={selectedItem.prefabId} />
              <MetricRow label="X" value={selectedItem.x.toString()} />
              <MetricRow label="Y" value={selectedItem.y.toString()} />
              <MetricRow label="Z" value={selectedItem.z.toString()} />
              <MetricRow label="Rotacao" value={`${selectedItem.rotationY}°`} />
            </div>

            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Rotacao</p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    onClick={() => onRotateQuarterTurn(-90)}
                    type="button"
                  >
                    -90°
                  </button>
                  <button
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    onClick={() => onRotateQuarterTurn(90)}
                    type="button"
                  >
                    +90°
                  </button>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Escala</span>
                <input
                  className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/78 px-3 text-sm text-white outline-none transition focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/15"
                  min={0.1}
                  onChange={(event) => onScaleChange(Number(event.target.value))}
                  step={0.1}
                  type="number"
                  value={selectedItem.scale}
                />
              </label>

              {showTagField ? (
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tag</span>
                  <input
                    className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/78 px-3 text-sm text-white outline-none transition focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/15"
                    onChange={(event) => onTagChange(event.target.value)}
                    type="text"
                    value={selectedItem.tag ?? ""}
                  />
                </label>
              ) : null}

              {showZoneField ? (
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Zone ID</span>
                  <input
                    className="min-h-10 rounded-2xl border border-white/10 bg-slate-950/78 px-3 text-sm text-white outline-none transition focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/15"
                    onChange={(event) => onZoneIdChange(event.target.value)}
                    type="text"
                    value={selectedItem.zoneId ?? ""}
                  />
                </label>
              ) : null}

              <button
                className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-rose-300/25 bg-rose-500/12 px-3 text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-500/18"
                onClick={onDeleteSelectedItem}
                type="button"
              >
                Remover item
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-[20px] border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Base</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <MetricRow label="Agua" value={stats.water.toString()} />
            <MetricRow label="Grama" value={stats.grass.toString()} />
            <MetricRow label="Pedra" value={stats.stone.toString()} />
            <MetricRow label="Flora" value={stats.flora.toString()} />
          </div>
        </div>
      </div>
    </aside>
  );
}