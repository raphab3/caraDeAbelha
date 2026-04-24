import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import styles from "./AdminLayout.module.css";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  headerMode?: "default" | "hidden";
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
  return [styles.navItem, isActive ? styles.navItemActive : ""].filter(Boolean).join(" ");
}

function resolveNavBadgeClassName(isActive: boolean): string {
  return [styles.navBadge, isActive ? styles.navBadgeActive : ""].filter(Boolean).join(" ");
}

export function AdminLayout({ children, title, description, headerMode = "default" }: AdminLayoutProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <aside className={styles.sidebar}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/70">Admin</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Ferramentas internas</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Monitoramento e operacao sem misturar com a rota do jogador.</p>

          <nav aria-label="Ferramentas administrativas" className="mt-6 space-y-2.5">
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

          <div className={styles.quickAccess}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Acesso rapido</p>
            <Link
              className={styles.quickLink}
              to="/"
            >
              Voltar para o login do jogador
            </Link>
          </div>
        </aside>

        <main className={styles.main}>
          {headerMode === "default" ? (
            <header className={styles.header}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Painel operacional</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{description}</p>
            </header>
          ) : null}

          <section className={[styles.content, headerMode === "default" ? styles.contentWithHeader : ""].filter(Boolean).join(" ")}>{children}</section>
        </main>
      </div>
    </div>
  );
}
