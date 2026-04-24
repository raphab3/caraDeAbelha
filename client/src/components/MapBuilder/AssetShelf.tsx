import { useMemo } from "react";

import type { MapBuilderCatalogItem } from "./types";

interface AssetShelfProps {
  items: readonly MapBuilderCatalogItem[];
  selectedPrefabId: string | null;
  onSelect: (prefabId: string) => void;
}

const CATEGORY_LABELS: Record<MapBuilderCatalogItem["category"], string> = {
  border: "Borda",
  landmark: "Marco",
  nature: "Natureza",
  setdressing: "Cena",
  terrain: "Terreno",
};

export function AssetShelf({ items, selectedPrefabId, onSelect }: AssetShelfProps) {
  const groupedItems = useMemo(() => {
    const groups = new Map<MapBuilderCatalogItem["category"], MapBuilderCatalogItem[]>();

    for (const item of items) {
      const current = groups.get(item.category) ?? [];
      current.push(item);
      groups.set(item.category, current);
    }

    return Array.from(groups.entries());
  }, [items]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(2,6,23,0.94))] p-2.5 shadow-[0_14px_30px_rgba(2,6,23,0.28)] backdrop-blur-xl md:p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Biblioteca de itens</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Selecione um item e pinte direto no mapa.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          {selectedPrefabId ? "1 item ativo" : "nenhum item ativo"}
        </span>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {groupedItems.map(([category, categoryItems]) => (
          <section key={category} className="min-w-[170px] max-w-[190px] shrink-0 rounded-[18px] border border-white/10 bg-black/20 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/72">{CATEGORY_LABELS[category]}</p>
            <div className="mt-2 grid max-h-[140px] gap-1.5 overflow-y-auto pr-1">
              {categoryItems.map((item) => {
                const isSelected = item.prefabId === selectedPrefabId;

                return (
                  <button
                    key={item.prefabId}
                    className={[
                      "flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-sm font-semibold transition-colors",
                      isSelected
                        ? "border-amber-300/45 bg-amber-300/16 text-amber-100"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-amber-200/20 hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => onSelect(item.prefabId)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        {item.category}
                      </span>
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {item.defaultScale.toFixed(2)}x
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
