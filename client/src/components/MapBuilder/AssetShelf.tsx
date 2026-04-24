import { useMemo, useState } from "react";

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

  const [activeCategory, setActiveCategory] = useState<MapBuilderCatalogItem["category"]>(groupedItems[0]?.[0] ?? "terrain");
  const activeItems = groupedItems.find(([category]) => category === activeCategory)?.[1] ?? [];

  return (
    <section className="h-full overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0.96))] p-2.5 shadow-[0_14px_30px_rgba(2,6,23,0.28)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Biblioteca</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Selecione e pinte.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
          {selectedPrefabId ? "1 ativo" : "nenhum"}
        </span>
      </div>

      <div className="grid h-[calc(100%-3rem)] grid-cols-[92px_minmax(0,1fr)] gap-2">
        <div className="space-y-1.5 overflow-y-auto pr-1">
          {groupedItems.map(([category, categoryItems]) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                className={[
                  "w-full rounded-xl border px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  isActive
                    ? "border-amber-300/45 bg-amber-300/16 text-amber-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-200/25 hover:bg-white/10",
                ].join(" ")}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                <span className="block truncate">{CATEGORY_LABELS[category]}</span>
                <span className="mt-1 block text-[10px] text-slate-400">{categoryItems.length}</span>
              </button>
            );
          })}
        </div>

        <div className="grid auto-rows-min content-start gap-1.5 overflow-y-auto pr-1">
          {activeItems.map((item) => {
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
                  <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    {item.category}
                  </span>
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {item.defaultScale.toFixed(2)}x
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
