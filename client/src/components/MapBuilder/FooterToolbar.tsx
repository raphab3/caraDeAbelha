import type { MapBuilderTool } from "./types";

interface FooterToolbarProps {
  currentTool: MapBuilderTool;
  hasSelection: boolean;
  onCopySelected: () => void;
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
  onPaste,
  onToolChange,
}: FooterToolbarProps) {
  return (
    <div className="mx-auto flex w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-[0_18px_38px_rgba(2,6,23,0.38)] backdrop-blur-xl">
      <button className={buttonClassName(currentTool === "paint")} onClick={() => onToolChange("paint")} type="button">
        Pintar
      </button>
      <button className={buttonClassName(currentTool === "delete")} onClick={() => onToolChange("delete")} type="button">
        Deletar
      </button>
      <button className="sr-only" disabled={!hasSelection} onClick={onCopySelected} type="button">
        Copiar selecao
      </button>
      <button className="sr-only" onClick={onPaste} type="button">
        Colar selecao
      </button>
    </div>
  );
}
