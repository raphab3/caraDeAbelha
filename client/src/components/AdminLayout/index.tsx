import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
}

interface AdminNavItem {
  to: string;
  label: string;
  description: string;
  badge: string;
  end?: boolean;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    to: "/admin",
    label: "Dashboard",
    description: "Monitor do servidor.",
    badge: "inicio",
    end: true,
  },
  {
    to: "/admin/mapas",
    label: "Gerador de mapas",
    description: "Geracao e exportacao.",
    badge: "tool",
  },
  {
    to: "/admin/builder",
    label: "Map Builder Pro",
    description: "Autoria visual de stages.",
    badge: "editor",
  },
];

function resolveNavItemClassName(isActive: boolean): string {
  return [
    "flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors duration-150",
    isActive
      ? "border-amber-300/40 bg-amber-300/12 text-amber-100 shadow-[0_18px_36px_rgba(15,23,42,0.24)]"
      : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-200/20 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

function resolveNavBadgeClassName(isActive: boolean): string {
  return [
    "inline-flex min-h-8 items-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.2em]",
    isActive
      ? "border-amber-200/30 bg-amber-200/14 text-amber-100"
      : "border-white/10 bg-white/5 text-slate-400",
  ].join(" ");
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 md:px-6 lg:flex-row lg:px-8 lg:py-6">
        <aside className="w-full rounded-[28px] border border-white/10 bg-slate-950/65 p-6 shadow-[0_28px_80px_rgba(2,6,23,0.45)] backdrop-blur lg:max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/70">Admin</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Ferramentas internas</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">Monitoramento e operacao sem misturar com a rota do jogador.</p>

          <nav aria-label="Ferramentas administrativas" className="mt-8 space-y-3">
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => resolveNavItemClassName(isActive)}
                end={item.end}
                to={item.to}
              >
                {({ isActive }) => (
                  <>
                    <div>
                      <span className="block text-sm font-semibold text-inherit">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                    </div>
                    <span className={resolveNavBadgeClassName(isActive)}>{isActive ? "ativo" : item.badge}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Acesso rapido</p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:border-amber-200/30 hover:bg-white/15"
              to="/"
            >
              Voltar para o login do jogador
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 rounded-[32px] border border-white/10 bg-slate-900/60 p-4 shadow-[0_28px_80px_rgba(2,6,23,0.38)] backdrop-blur md:p-6">
          <header className="rounded-[28px] border border-white/8 bg-black/20 px-5 py-5 md:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Painel operacional</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{description}</p>
          </header>

          <section className="mt-6 min-w-0">{children}</section>
        </main>
      </div>
    </div>
  );
}