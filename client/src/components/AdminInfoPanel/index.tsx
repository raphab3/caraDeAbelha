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

interface MonitorCardProps {
  label: string;
  value: string;
}

function MonitorCard({ label, value }: MonitorCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <strong className="mt-3 block text-[clamp(1.3rem,2vw,1.8rem)] font-semibold leading-tight text-white [overflow-wrap:anywhere]">
        {value}
      </strong>
    </article>
  );
}

export function AdminInfoPanel() {
  const backendHealth = useBackendHealth();
  const serverMetrics = useServerMetrics();
  const clientFPS = useClientFPS();

  return (
    <aside className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.28)] backdrop-blur md:p-5">
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Monitor</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Tempo real</h3>
        </div>
        <span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold uppercase ${resolveHealthTone(backendHealth.state)}`}>
          API {resolveHealthLabel(backendHealth.state)}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <MonitorCard label="Jogadores" value={serverMetrics.activePlayers.toString()} />
        <MonitorCard label="FPS" value={clientFPS > 0 ? `${clientFPS}` : "--"} />
        <MonitorCard label="Ping" value={backendHealth.latencyMs !== undefined ? `${backendHealth.latencyMs} ms` : "--"} />
        <MonitorCard label="API health" value={resolveHealthLabel(backendHealth.state)} />
      </div>
    </aside>
  );
}