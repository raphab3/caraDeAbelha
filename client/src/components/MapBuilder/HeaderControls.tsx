import styles from "./HeaderControls.module.css";

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
    <section className={styles.panel}>
      <div className={styles.topRow}>
        <div className={styles.titleGroup}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/72">Editor</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">Map Builder Pro</h3>
        </div>

        <div className={styles.actions}>
          {isFullscreenSupported ? (
            <button
              className={styles.button}
              onClick={onToggleFullscreen}
              type="button"
            >
              {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </button>
          ) : null}
          <button
            className={styles.button}
            onClick={onGenerateBase}
            type="button"
          >
            Gerar base
          </button>
          <button
            className={styles.exportButton}
            onClick={onExportStage}
            type="button"
          >
            Exportar
          </button>
        </div>
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Nome</span>
          <input
            className={styles.input}
            onChange={(event) => onMapNameChange(event.target.value)}
            type="text"
            value={mapName}
          />
        </label>

        <label className={styles.field}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Seed</span>
          <input
            className={styles.input}
            onChange={(event) => onProceduralSeedChange(event.target.value)}
            type="text"
            value={proceduralSeed}
          />
        </label>

        <label className={styles.field}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Grid</span>
          <input
            className={styles.input}
            min={1}
            onChange={(event) => onMapSizeChange(Number(event.target.value))}
            step={1}
            type="number"
            value={mapSize}
          />
        </label>

        <label className={styles.field}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Altura Y</span>
          <input
            className={styles.input}
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
