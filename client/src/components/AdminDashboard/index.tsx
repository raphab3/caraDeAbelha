import { Link } from "react-router-dom";

import { useBackendHealth } from "../../hooks/useBackendHealth";
import { useClientFPS } from "../../hooks/useClientFPS";
import { useServerMetrics } from "../../hooks/useServerMetrics";

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
      return "border-emerald-300/25 bg-emerald-300/12 text-emerald-100";
    case "offline":
      return "border-rose-300/25 bg-rose-300/12 text-rose-100";
    default:
      return "border-amber-300/25 bg-amber-300/12 text-amber-100";
  }
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5 shadow-[0_20px_44px_rgba(2,6,23,0.26)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <strong className="mt-4 block text-[clamp(1.5rem,2vw,2rem)] font-semibold leading-tight text-white [overflow-wrap:anywhere]">
        {value}
      </strong>
    </article>
  );
}

export function AdminDashboard() {
  const backendHealth = useBackendHealth();
  const serverMetrics = useServerMetrics();
  const clientFPS = useClientFPS();

  return (
    <div className="grid gap-6">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.88),rgba(15,23,42,0.58))] p-6 shadow-[0_28px_70px_rgba(2,6,23,0.34)] md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-200/70">Monitor</p>
            <h3 className="mt-4 text-3xl font-semibold text-white md:text-4xl">Servidor e clientes em tempo real</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold uppercase ${resolveHealthTone(backendHealth.state)}`}>
              API {resolveHealthLabel(backendHealth.state)}
            </span>
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-amber-300/35 bg-amber-300/14 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20"
              to="/admin/mapas"
            >
              Abrir gerador de mapas
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <MetricCard label="Jogadores online" value={serverMetrics.activePlayers.toString()} />
        <MetricCard label="FPS" value={clientFPS > 0 ? `${clientFPS}` : "--"} />
        <MetricCard label="Ping" value={backendHealth.latencyMs !== undefined ? `${backendHealth.latencyMs} ms` : "--"} />
        <MetricCard label="API health" value={resolveHealthLabel(backendHealth.state)} />
      </div>
    </div>
  );
}