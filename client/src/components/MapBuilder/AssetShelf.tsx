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
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.84),rgba(2,6,23,0.96))] p-3 shadow-[0_20px_50px_rgba(2,6,23,0.38)] backdrop-blur md:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Biblioteca de itens</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">Escolha um item para adicionar ao mapa.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          {selectedPrefabId ? "1 item ativo" : "nenhum item ativo"}
        </span>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {groupedItems.map(([category, categoryItems]) => (
          <section key={category} className="min-w-[240px] shrink-0 rounded-[24px] border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/72">{CATEGORY_LABELS[category]}</p>
            <div className="mt-3 grid gap-2">
              {categoryItems.map((item) => {
                const isSelected = item.prefabId === selectedPrefabId;

                return (
                  <button
                    key={item.prefabId}
                    className={[
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors",
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