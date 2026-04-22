import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminDashboard } from "./components/AdminDashboard";
import { AdminLayout } from "./components/AdminLayout";
import { AdminInfoPanel } from "./components/AdminInfoPanel";

const MapBuilder = lazy(() => import("./components/MapBuilder"));
const MapGenerator = lazy(() => import("./components/MapGenerator"));
const PlayerExperience = lazy(() => import("./components/PlayerExperience"));

interface RouteFallbackProps {
  title: string;
  description: string;
}

function RouteFallback({ title, description }: RouteFallbackProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-50">
      <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/70">Cara de Abelha</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
      </div>
    </main>
  );
}

function AdminToolsRoute() {
  return (
    <AdminLayout
      description="Monitoramento do servidor e atalhos internos."
      title="Dashboard do servidor"
    >
      <AdminDashboard />
    </AdminLayout>
  );
}

function AdminMapGeneratorRoute() {
  return (
    <AdminLayout
      description="Geracao de mapas com monitor lateral."
      title="Gerador de mapas"
    >
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-start">
        <Suspense
          fallback={
            <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-white/10 bg-slate-950/70 px-6 text-center text-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Admin</p>
                <p className="mt-3 text-base">Carregando gerador de fases...</p>
              </div>
            </div>
          }
        >
          <MapGenerator embedded />
        </Suspense>

        <AdminInfoPanel />
      </div>
    </AdminLayout>
  );
}

function AdminMapBuilderRoute() {
  return (
    <AdminLayout
      description="Monte o mapa, ajuste a base e organize os elementos antes de exportar."
      title="Map Builder Pro"
    >
      <Suspense
        fallback={
          <div className="grid min-h-[520px] place-items-center rounded-[28px] border border-white/10 bg-slate-950/70 px-6 text-center text-slate-300">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">Admin</p>
              <p className="mt-3 text-base">Abrindo editor de mapas...</p>
            </div>
          </div>
        }
      >
        <MapBuilder />
      </Suspense>
    </AdminLayout>
  );
}

export function App() {
  return (
    <Suspense
      fallback={
        <RouteFallback
          title="Preparando a rota"
          description="Separando a experiencia do jogador das ferramentas internas."
        />
      }
    >
      <Routes>
        <Route path="/" element={<PlayerExperience />} />
        <Route path="/admin" element={<AdminToolsRoute />} />
        <Route path="/admin/builder" element={<AdminMapBuilderRoute />} />
        <Route path="/admin/mapas" element={<AdminMapGeneratorRoute />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Suspense>
  );
}