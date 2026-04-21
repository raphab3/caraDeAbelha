import { Suspense, lazy, useEffect, useState } from "react";

import { GameViewport } from "./components/GameViewport";
import { LoginGate } from "./components/LoginGate";
import { StatusPanel } from "./components/StatusPanel";
import { API_URL, WS_URL } from "./game/env";
import { useFullscreenTarget } from "./hooks/useFullscreenTarget";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useGameSession } from "./hooks/useGameSession";
import type { RenderPerformanceSnapshot } from "./types/game";

const USERNAME_STORAGE_KEY = "cara-de-abelha.username";
const MapGenerator = lazy(() => import("./components/MapGenerator"));

function isMapGeneratorPath(pathname: string): boolean {
  return pathname === "/dev/mapa" || pathname === "/dev/mapa/";
}

function readStoredUsername(): string {
  return window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() ?? "";
}

function GameApp() {
  const [draftUsername, setDraftUsername] = useState(readStoredUsername);
  const [activeUsername, setActiveUsername] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [renderPerformance, setRenderPerformance] = useState<RenderPerformanceSnapshot>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });
  const backendHealth = useBackendHealth();
  const gameSession = useGameSession(activeUsername);
  const { targetRef, isFullscreen, isSupported, toggleFullscreen } =
    useFullscreenTarget<HTMLDivElement>();

  useEffect(() => {
    if (gameSession.connectionState !== "connected" || !gameSession.localUsername) {
      return;
    }

    window.localStorage.setItem(USERNAME_STORAGE_KEY, gameSession.localUsername);
  }, [gameSession.connectionState, gameSession.localUsername]);

  const loginError =
    formError ??
    (activeUsername && gameSession.connectionState === "disconnected" ? gameSession.error : undefined);

  const showLoginGate = !gameSession.localPlayerId;

  const handleJoin = () => {
    const normalizedUsername = draftUsername.trim();

    if (!normalizedUsername) {
      setFormError("Escolha um username para entrar no jogo.");
      return;
    }

    if (normalizedUsername.length > 24) {
      setFormError("Use no maximo 24 caracteres no username.");
      return;
    }

    setFormError(undefined);
    setActiveUsername(normalizedUsername);
  };

  return (
    <main className="app-shell">
      <section className="hero-copy" aria-label="Resumo do projeto">
        <h1>Sem Cara de Abelha</h1>
      </section>

      <section className="experience-card" aria-label="Viewport 3D inicial">
        <div className="experience-stage" ref={targetRef}>
          <div className="viewport-shell">
            <GameViewport
              chunks={gameSession.chunks}
              chunkSize={gameSession.chunkSize}
              renderDistance={gameSession.renderDistance}
              connectionState={gameSession.connectionState}
              localPlayerId={gameSession.localPlayerId}
              onPerformanceChange={setRenderPerformance}
              onMoveToTarget={gameSession.moveToTarget}
              onRespawn={gameSession.respawn}
              players={gameSession.players}
            />
          </div>

          {showLoginGate ? (
            <LoginGate
              connectionState={gameSession.connectionState}
              error={loginError}
              onSubmit={handleJoin}
              onUsernameChange={(value) => {
                setDraftUsername(value);
                setFormError(undefined);
              }}
              username={draftUsername}
            />
          ) : null}

          {isSupported ? (
            <button
              aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
              aria-pressed={isFullscreen}
              className="viewport-fullscreen-toggle"
              onClick={() => {
                void toggleFullscreen();
              }}
              type="button"
            >
              {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </button>
          ) : null}
        </div>

        <StatusPanel
          backendHealth={backendHealth}
          gameSession={gameSession}
          apiUrl={API_URL}
          renderPerformance={renderPerformance}
          wsUrl={WS_URL}
        />
      </section>
    </main>
  );
}

export function App() {
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;

  if (isMapGeneratorPath(pathname)) {
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <section className="hero-copy" aria-label="Carregando gerador de mapa">
              <h1>Carregando gerador de mapa...</h1>
            </section>
          </main>
        }
      >
        <MapGenerator />
      </Suspense>
    );
  }

  return <GameApp />;
}