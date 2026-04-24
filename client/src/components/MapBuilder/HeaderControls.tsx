import styles from "./HeaderControls.module.css";

interface MobConfigValue {
  meleeCount: number;
  rangedCount: number;
  moveRadius: number;
  pursuitLevel: number;
  minLevel: number;
  maxLevel: number;
}

interface HeaderControlsProps {
  defaultY: number;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  mapName: string;
  mapSize: number;
  mobConfig: MobConfigValue;
  proceduralSeed: string;
  onDefaultYChange: (nextY: number) => void;
  onExportStage: () => void;
  onSaveStage: () => void;
  onToggleFullscreen: () => void;
  onGenerateBase: () => void;
  onMapNameChange: (name: string) => void;
  onMapSizeChange: (size: number) => void;
  onMobConfigChange: (config: Partial<MobConfigValue>) => void;
  onProceduralSeedChange: (seed: string) => void;
}

export function HeaderControls({
  defaultY,
  isFullscreen,
  isFullscreenSupported,
  mapName,
  mapSize,
  mobConfig,
  proceduralSeed,
  onDefaultYChange,
  onExportStage,
  onToggleFullscreen,
  onGenerateBase,
  onSaveStage,
  onMapNameChange,
  onMapSizeChange,
  onMobConfigChange,
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
          <button
            className={styles.exportButton}
            onClick={onSaveStage}
            type="button"
          >
            Salvar no admin
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

      <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/78">Mobs</p>
            <p className="mt-1 text-xs text-slate-300">Define quantos inimigos o stage gera, o raio de patrulha e o nivel de perseguicao.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white">
            {mobConfig.meleeCount + mobConfig.rangedCount} total
          </span>
        </div>

        <div className={`${styles.fields} mt-3`}>
          <label className={styles.field}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Corpo a corpo</span>
            <input
              className={styles.input}
              min={0}
              onChange={(event) => onMobConfigChange({ meleeCount: Number(event.target.value) })}
              step={1}
              type="number"
              value={mobConfig.meleeCount}
            />
          </label>

          <label className={styles.field}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Longo alcance</span>
            <input
              className={styles.input}
              min={0}
              onChange={(event) => onMobConfigChange({ rangedCount: Number(event.target.value) })}
              step={1}
              type="number"
              value={mobConfig.rangedCount}
            />
          </label>

          <label className={styles.field}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Raio de patrulha</span>
            <input
              className={styles.input}
              min={1}
              onChange={(event) => onMobConfigChange({ moveRadius: Number(event.target.value) })}
              step={0.5}
              type="number"
              value={mobConfig.moveRadius}
            />
          </label>

          <label className={styles.field}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Perseguicao</span>
            <input
              className={styles.input}
              max={5}
              min={1}
              onChange={(event) => onMobConfigChange({ pursuitLevel: Number(event.target.value) })}
              step={1}
              type="number"
              value={mobConfig.pursuitLevel}
            />
          </label>

          <label className={styles.field}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Nivel minimo</span>
            <input
              className={styles.input}
              min={1}
              onChange={(event) => onMobConfigChange({ minLevel: Number(event.target.value) })}
              step={1}
              type="number"
              value={mobConfig.minLevel}
            />
          </label>

          <label className={styles.field}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Nivel maximo</span>
            <input
              className={styles.input}
              min={mobConfig.minLevel}
              onChange={(event) => onMobConfigChange({ maxLevel: Number(event.target.value) })}
              step={1}
              type="number"
              value={mobConfig.maxLevel}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
