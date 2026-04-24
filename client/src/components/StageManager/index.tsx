import { useState } from "react";

import { API_URL } from "../../game/env";
import { useAdminStages } from "../../hooks/useAdminStages";
import type { AdminStageSummaryDTO } from "../../types/game";
import styles from "./StageManager.module.css";

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("pt-BR");
}

function shortChecksum(value?: string): string {
  return value ? value.slice(0, 12) : "-";
}

function StageCard({
  stage,
  busyAction,
  onAction,
}: {
  stage: AdminStageSummaryDTO;
  busyAction: string | null;
  onAction: (label: string, action: () => Promise<unknown>) => void;
}) {
  const busy = Boolean(busyAction);
  const isActive = stage.status === "active";
  const latestVersionId = stage.latestVersionId;

  return (
    <article className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{stage.slug}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{stage.displayName}</h3>
        </div>
        <span className={[styles.badge, isActive ? styles.activeBadge : ""].filter(Boolean).join(" ")}>
          {stage.status}
        </span>
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaBox}>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Versao</span>
          <strong>v{stage.latestVersion || 0}</strong>
        </div>
        <div className={styles.metaBox}>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Checksum</span>
          <strong>{shortChecksum(stage.checksum)}</strong>
        </div>
        <div className={styles.metaBox}>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Atualizado</span>
          <strong>{formatDate(stage.updatedAt)}</strong>
        </div>
      </div>

      <div className={styles.actions}>
        {latestVersionId ? (
          <>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => onAction("Publicando stage", () => fetch(`${API_URL}/admin/stage-versions/${latestVersionId}/publish`, { method: "POST" }).then(assertOk))}
              type="button"
            >
              Publicar
            </button>
            <button
              className={styles.button}
              disabled={busy || isActive}
              onClick={() => onAction("Ativando stage", () => fetch(`${API_URL}/admin/stage-versions/${latestVersionId}/activate`, { method: "POST" }).then(assertOk))}
              type="button"
            >
              Definir ativo
            </button>
            <a className={styles.secondaryButton} href={`${API_URL}/admin/stage-versions/${latestVersionId}/export`}>
              Exportar JSON
            </a>
          </>
        ) : null}
        <button
          className={styles.secondaryButton}
          disabled={busy}
          onClick={() => onAction("Executando rollback", () => fetch(`${API_URL}/admin/stages/${stage.id}/rollback`, { method: "POST" }).then(assertOk))}
          type="button"
        >
          Rollback
        </button>
        <button
          className={styles.dangerButton}
          disabled={busy || isActive}
          onClick={() => onAction("Arquivando stage", () => fetch(`${API_URL}/admin/stages/${stage.id}/archive`, { method: "POST" }).then(assertOk))}
          type="button"
        >
          Arquivar
        </button>
      </div>
    </article>
  );
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as { error?: string; fields?: string[] } | undefined;
    throw new Error([payload?.error ?? `HTTP ${response.status}`, ...(payload?.fields ?? [])].join(": "));
  }
}

export default function StageManager() {
  const stages = useAdminStages();
  const [sourceJson, setSourceJson] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusyAction(label);
    setError(undefined);
    setMessage(undefined);
    try {
      await action();
      await stages.reload();
      setMessage(`${label} concluido.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "erro desconhecido");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleImport() {
    await runAction("Importando stage", async () => {
      const result = await stages.importStage(sourceJson);
      setSourceJson("");
      return result;
    });
  }

  return (
    <div className={styles.root}>
      <section className={styles.toolbar}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Catalogo de stages</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Publicacao sem deploy</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Importe o JSON do builder, valide, publique e ative uma versao mantendo o runtime cacheado no servidor.
          </p>
        </div>

        <textarea
          className={styles.textarea}
          onChange={(event) => setSourceJson(event.target.value)}
          placeholder="Cole aqui o JSON exportado pelo Map Builder Pro"
          value={sourceJson}
        />

        <div className={styles.actions}>
          <button className={styles.button} disabled={Boolean(busyAction) || !sourceJson.trim()} onClick={handleImport} type="button">
            {busyAction === "Importando stage" ? "Importando..." : "Importar JSON"}
          </button>
          <button className={styles.secondaryButton} disabled={Boolean(busyAction)} onClick={() => void stages.reload()} type="button">
            Atualizar lista
          </button>
        </div>

        {message ? <p className={styles.message}>{message}</p> : null}
        {error ?? stages.error ? <p className={styles.error}>{error ?? stages.error}</p> : null}
      </section>

      <section className={styles.grid} aria-label="Stages cadastrados">
        {stages.stages.length === 0 ? (
          <div className={styles.stageCard}>
            <p className="text-sm text-slate-300">Nenhum stage importado ainda. O servidor ainda pode estar usando o fallback `server/maps/map.json`.</p>
          </div>
        ) : (
          stages.stages.map((stage) => (
            <StageCard key={stage.id} stage={stage} busyAction={busyAction} onAction={runAction} />
          ))
        )}
      </section>
    </div>
  );
}
