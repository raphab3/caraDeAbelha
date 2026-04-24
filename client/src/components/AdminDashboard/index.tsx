import { Link } from "react-router-dom";

import { AdminPlayersCard } from "../AdminPlayersCard";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import { useClientFPS } from "../../hooks/useClientFPS";
import { useServerMetrics } from "../../hooks/useServerMetrics";
import styles from "./AdminDashboard.module.css";

function resolveHealthLabel(state: ReturnType<typeof useBackendHealth>["state"]): string {
  switch (state) {
    case "online":
      return "online";
    case "offline":
      return "offline";
    default:
      return "checando";
  }
}

function resolveHealthTone(state: ReturnType<typeof useBackendHealth>["state"]): string {
  switch (state) {
    case "online":
      return styles.healthOnline;
    case "offline":
      return styles.healthOffline;
    default:
      return styles.healthLoading;
  }
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <article className={styles.metricCard}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <strong className={styles.metricValue}>{value}</strong>
    </article>
  );
}

export function AdminDashboard() {
  const backendHealth = useBackendHealth();
  const serverMetrics = useServerMetrics();
  const clientFPS = useClientFPS();

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-200/70">Monitor</p>
            <h3 className="mt-4 text-3xl font-semibold text-white md:text-4xl">Servidor e clientes em tempo real</h3>
          </div>

          <div className={styles.actions}>
            <span className={[styles.statusPill, resolveHealthTone(backendHealth.state)].join(" ")}>
              API {resolveHealthLabel(backendHealth.state)}
            </span>
            <Link
              className={styles.mapLink}
              to="/admin/mapas"
            >
              Abrir gerador de mapas
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <MetricCard label="Jogadores online" value={serverMetrics.activePlayers.toString()} />
        <MetricCard label="FPS" value={clientFPS > 0 ? `${clientFPS}` : "--"} />
        <MetricCard label="Ping" value={backendHealth.latencyMs !== undefined ? `${backendHealth.latencyMs} ms` : "--"} />
        <MetricCard label="API health" value={resolveHealthLabel(backendHealth.state)} />
      </div>

      <AdminPlayersCard />
    </div>
  );
}
