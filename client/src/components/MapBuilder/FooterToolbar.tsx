import type { MapBuilderTool } from "./types";

interface FooterToolbarProps {
  currentTool: MapBuilderTool;
  hasSelection: boolean;
  onCopySelected: () => void;
  onDeleteSelected: () => void;
  onNewItem: () => void;
  onPaste: () => void;
  onToolChange: (tool: MapBuilderTool) => void;
}

function buttonClassName(active = false): string {
  return [
    "inline-flex min-h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors",
    active
      ? "border-amber-300/45 bg-amber-300/16 text-amber-100"
      : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-200/25 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export function FooterToolbar({
  currentTool,
  hasSelection,
  onCopySelected,
  onDeleteSelected,
  onNewItem,
  onPaste,
  onToolChange,
}: FooterToolbarProps) {
  return (
    <div className="mx-auto flex w-full max-w-[780px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-[0_18px_38px_rgba(2,6,23,0.38)] backdrop-blur-xl">
      <button className={buttonClassName()} onClick={onNewItem} type="button">
        Novo item
      </button>
      <button className={buttonClassName(currentTool === "paint")} onClick={() => onToolChange("paint")} type="button">
        Pintar
      </button>
      <button className={buttonClassName(currentTool === "select")} onClick={() => onToolChange("select")} type="button">
        Selecionar
      </button>
      <button className={buttonClassName(currentTool === "delete")} onClick={() => onToolChange("delete")} type="button">
        Deletar
      </button>
      <span className="mx-1 h-8 w-px bg-white/10" aria-hidden />
      <button className={buttonClassName()} disabled={!hasSelection} onClick={onCopySelected} type="button">
        Copiar
      </button>
      <button className={buttonClassName()} onClick={onPaste} type="button">
        Colar
      </button>
      <button className={buttonClassName()} disabled={!hasSelection} onClick={onDeleteSelected} type="button">
        Remover
      </button>
    </div>
  );
}
