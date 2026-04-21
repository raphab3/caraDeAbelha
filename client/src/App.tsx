import { useEffect, useState } from "react";

import { GameViewport } from "./components/GameViewport";
import { LoginGate } from "./components/LoginGate";
import { StatusPanel } from "./components/StatusPanel";
import { API_URL, WS_URL } from "./game/env";
import { useFullscreenTarget } from "./hooks/useFullscreenTarget";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { useGameSession } from "./hooks/useGameSession";

const USERNAME_STORAGE_KEY = "cara-de-abelha.username";

function readStoredUsername(): string {
  return window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() ?? "";
}

export function App() {
  const [draftUsername, setDraftUsername] = useState(readStoredUsername);
  const [activeUsername, setActiveUsername] = useState<string>();
  const [formError, setFormError] = useState<string>();
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
        <p className="eyebrow">Fase 1</p>
        <h1>Cara de Abelha</h1>
        <p className="hero-text">
          Entre com um username local para puxar o estado da sua abelha, seguir sua camera e
          aparecer para os outros jogadores no jardim.
        </p>
      </section>

      <section className="experience-card" aria-label="Viewport 3D inicial">
        <div className="experience-stage" ref={targetRef}>
          <div className="viewport-shell">
            <GameViewport
              chunks={gameSession.chunks}
              chunkSize={gameSession.chunkSize}
              connectionState={gameSession.connectionState}
              localPlayerId={gameSession.localPlayerId}
              onMoveToTarget={gameSession.moveToTarget}
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
          wsUrl={WS_URL}
        />
      </section>
    </main>
  );
}