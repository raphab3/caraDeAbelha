import { API_URL, WS_URL } from "../../game/env";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import type { HealthStatusState } from "../../types/game";

interface AdminInfoPanelProps {
  backendHealth?: HealthStatusState;
}

function resolveStatusLabel(backendHealth: HealthStatusState): string {
  if (backendHealth.state === "loading") {
    return "Checando backend";
  }

  if (backendHealth.state === "online") {
    return `Online: ${backendHealth.service}`;
  }

  return `Erro: ${backendHealth.error ?? "health check indisponivel"}`;
}

function resolveStatusClassName(state: HealthStatusState["state"]): string {
  if (state === "online") {
    return "border-emerald-300/25 bg-emerald-300/12 text-emerald-100";
  }

  if (state === "offline") {
    return "border-rose-300/25 bg-rose-300/12 text-rose-100";
  }

  return "border-amber-300/25 bg-amber-300/12 text-amber-100";
}

function formatUpdatedAt(updatedAt?: string): string {
  if (!updatedAt) {
    return "aguardando primeira resposta";
  }

  return new Date(updatedAt).toLocaleTimeString("pt-BR");
}

function resolveEndpointHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface InfoCardProps {
  label: string;
  value: string;
  helper: string;
}

function InfoCard({ label, value, helper }: InfoCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <strong className="mt-3 block text-lg font-semibold text-white">{value}</strong>
      <p className="mt-3 text-sm leading-6 text-slate-300">{helper}</p>
    </article>
  );
}

export function AdminInfoPanel({ backendHealth: externalHealth }: AdminInfoPanelProps) {
  const liveBackendHealth = useBackendHealth();
  const backendHealth = externalHealth ?? liveBackendHealth;

  return (
    <aside className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.28)] backdrop-blur md:p-5">
      <div className="mb-5 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Informacoes</p>
        <h3 className="mt-3 text-xl font-semibold text-white">Estado do ambiente</h3>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          Backend, endpoints e horario do ultimo health check ficam visiveis aqui enquanto voce trabalha nas ferramentas internas.
        </p>
      </div>

      <div className={`rounded-3xl border px-4 py-4 text-sm font-semibold ${resolveStatusClassName(backendHealth.state)}`}>
        {resolveStatusLabel(backendHealth)}
      </div>

      <div className="mt-4 grid gap-3">
        <InfoCard
          helper="Nome do servico retornado pelo endpoint /healthz."
          label="Servico"
          value={backendHealth.service ?? "aguardando health check"}
        />
        <InfoCard
          helper="Horario da ultima resposta valida recebida pelo painel."
          label="Ultimo ping"
          value={formatUpdatedAt(backendHealth.updatedAt)}
        />
        <InfoCard
          helper="Host base que atende a API REST do projeto."
          label="API REST"
          value={resolveEndpointHost(API_URL)}
        />
        <InfoCard
          helper="Endpoint websocket usado pela experiencia do jogador."
          label="WebSocket"
          value={resolveEndpointHost(WS_URL)}
        />
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
        O painel renova o health check automaticamente a cada 10 segundos para manter o dashboard sincronizado com o servidor local.
      </div>
    </aside>
  );
}