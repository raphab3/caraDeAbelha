import { GameViewport } from "./components/GameViewport";
import { StatusPanel } from "./components/StatusPanel";
import { API_URL, WS_URL } from "./game/env";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useGameSession } from "./hooks/useGameSession";

export function App() {
  const backendHealth = useBackendHealth();
  const gameSession = useGameSession();

  return (
    <main className="app-shell">
      <section className="hero-copy" aria-label="Resumo do projeto">
        <p className="eyebrow">Fase 1</p>
        <h1>Cara de Abelha</h1>
      </section>

      <section className="experience-card" aria-label="Viewport 3D inicial">
        <div className="viewport-shell">
          <GameViewport players={gameSession.players} connectionState={gameSession.connectionState} />
        </div>

        <StatusPanel
          backendHealth={backendHealth}
          gameSession={gameSession}
          apiUrl={API_URL}
          wsUrl={WS_URL}
        />
      </section>
    </main>
  );
}