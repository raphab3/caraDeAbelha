import { Link } from "react-router-dom";

import { AdminInfoPanel } from "../AdminInfoPanel";
import { API_URL, WS_URL } from "../../game/env";
import { useBackendHealth } from "../../hooks/useBackendHealth";

function resolveStatusLabel(state: ReturnType<typeof useBackendHealth>["state"]): string {
  switch (state) {
    case "online":
      return "Servidor online";
    case "offline":
      return "Servidor indisponivel";
    default:
      return "Checando backend";
  }
}

function resolveStatusTone(state: ReturnType<typeof useBackendHealth>["state"]): string {
  switch (state) {
    case "online":
      return "border-emerald-300/25 bg-emerald-300/12 text-emerald-100";
    case "offline":
      return "border-rose-300/25 bg-rose-300/12 text-rose-100";
    default:
      return "border-amber-300/25 bg-amber-300/12 text-amber-100";
  }
}

function formatUpdatedAt(updatedAt?: string): string {
  if (!updatedAt) {
    return "aguardando primeira resposta";
  }

  return new Date(updatedAt).toLocaleTimeString("pt-BR");
}

function resolveEndpointLabel(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.host;
  } catch {
    return url;
  }
}

interface OverviewCardProps {
  label: string;
  value: string;
  helper: string;
}

function OverviewCard({ label, value, helper }: OverviewCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5 shadow-[0_20px_44px_rgba(2,6,23,0.26)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <strong className="mt-4 block text-2xl font-semibold text-white">{value}</strong>
      <p className="mt-3 text-sm leading-6 text-slate-300">{helper}</p>
    </article>
  );
}

export function AdminDashboard() {
  const backendHealth = useBackendHealth();
  const serviceName = backendHealth.service ?? "cara-de-abelha-server";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <section className="grid gap-6">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.88),rgba(15,23,42,0.58))] p-6 shadow-[0_28px_70px_rgba(2,6,23,0.34)] md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-200/70">Visao geral</p>
              <h3 className="mt-4 text-3xl font-semibold text-white md:text-4xl">Servidor do mundo e ferramentas internas</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                Este dashboard concentra o estado do backend, os endpoints ativos e os atalhos para as ferramentas de suporte do mundo 3D.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${resolveStatusTone(backendHealth.state)}`}>
                {resolveStatusLabel(backendHealth.state)}
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

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <OverviewCard
            helper="Servico retornado pelo health check do backend."
            label="Servico"
            value={serviceName}
          />
          <OverviewCard
            helper="Base REST usada pelo cliente para health check e integracoes administrativas."
            label="API"
            value={resolveEndpointLabel(API_URL)}
          />
          <OverviewCard
            helper="Canal websocket usado pela experiencia do jogador em tempo real."
            label="WebSocket"
            value={resolveEndpointLabel(WS_URL)}
          />
          <OverviewCard
            helper="O dashboard renova automaticamente o health check a cada 10 segundos."
            label="Ultimo ping"
            value={formatUpdatedAt(backendHealth.updatedAt)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <article className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_24px_54px_rgba(2,6,23,0.28)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Operacao</p>
            <h4 className="mt-4 text-2xl font-semibold text-white">Fluxo recomendado para o admin</h4>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/70">1. Validar</span>
                <p className="mt-3 text-sm leading-6 text-slate-300">Confira se o backend responde e se os endpoints estao apontando para o host correto.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/70">2. Prototipar</span>
                <p className="mt-3 text-sm leading-6 text-slate-300">Abra o gerador para testar thresholds, seeds e densidade antes de exportar um novo mapa.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/70">3. Publicar</span>
                <p className="mt-3 text-sm leading-6 text-slate-300">Use o JSON exportado no servidor Go para atualizar o mundo padrao de desenvolvimento.</p>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_24px_54px_rgba(2,6,23,0.28)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Atalhos</p>
            <h4 className="mt-4 text-2xl font-semibold text-white">Acoes rapidas</h4>
            <div className="mt-5 grid gap-3">
              <Link
                className="inline-flex min-h-12 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-amber-200/30 hover:bg-white/10"
                to="/admin/mapas"
              >
                Ir para o gerador de mapas
              </Link>
              <Link
                className="inline-flex min-h-12 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-amber-200/30 hover:bg-white/10"
                to="/"
              >
                Voltar para o login do jogador
              </Link>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300">
              Se o health check falhar, a causa mais comum e o backend Go nao estar rodando ou o host exposto no container estar incorreto.
            </p>
          </article>
        </div>
      </section>

      <AdminInfoPanel backendHealth={backendHealth} />
    </div>
  );
}