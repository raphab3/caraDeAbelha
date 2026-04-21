import { useEffect, useState } from "react";

import { GameViewport } from "../GameViewport";
import { LoginGate } from "../LoginGate";
import { useFullscreenTarget } from "../../hooks/useFullscreenTarget";
import { useGameSession } from "../../hooks/useGameSession";

const USERNAME_STORAGE_KEY = "cara-de-abelha.username";

function readStoredUsername(): string {
  return window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() ?? "";
}

function ignoreRenderPerformance(): void {}

export default function PlayerExperience() {
  const [draftUsername, setDraftUsername] = useState(readStoredUsername);
  const [activeUsername, setActiveUsername] = useState<string>();
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [formError, setFormError] = useState<string>();
  const { targetRef, isFullscreen, isSupported, requestFullscreen, toggleFullscreen } =
    useFullscreenTarget<HTMLDivElement>();
  const gameSession = useGameSession(activeUsername, connectionAttempt);

  useEffect(() => {
    if (gameSession.connectionState !== "connected" || !gameSession.localUsername) {
      return;
    }

    window.localStorage.setItem(USERNAME_STORAGE_KEY, gameSession.localUsername);
  }, [gameSession.connectionState, gameSession.localUsername]);

  const loginError =
    formError ??
    (activeUsername && gameSession.connectionState === "disconnected" ? gameSession.error : undefined);

  const hasStartedAdventure = Boolean(activeUsername);
  const showLoginGate = !gameSession.localPlayerId;

  function renderStage(isImmersive: boolean) {
    const stageClassName = isImmersive
      ? "experience-stage player-experience__stage player-experience__stage--immersive w-screen h-screen overflow-hidden bg-black"
      : "experience-stage player-experience__stage";
    const viewportClassName = isImmersive ? "viewport-shell player-viewport-shell" : "viewport-shell";

    return (
      <div className={stageClassName} ref={targetRef}>
        {hasStartedAdventure ? (
          <div className={viewportClassName}>
            <GameViewport
              chunks={gameSession.chunks}
              chunkSize={gameSession.chunkSize}
              connectionState={gameSession.connectionState}
              localPlayerId={gameSession.localPlayerId}
              onMoveToTarget={gameSession.moveToTarget}
              onPerformanceChange={ignoreRenderPerformance}
              onRespawn={gameSession.respawn}
              players={gameSession.players}
              renderDistance={gameSession.renderDistance}
            />
          </div>
        ) : (
          <div className={`${viewportClassName} player-preview-shell`}>
            <div className="player-login-backdrop" aria-hidden="true" />
          </div>
        )}

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

        {hasStartedAdventure && isSupported ? (
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
    );
  }

  function handleJoin() {
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
    void requestFullscreen();
    setConnectionAttempt((current) => current + 1);
    setActiveUsername(normalizedUsername);
  }

  if (isFullscreen) {
    return <main className="player-experience player-experience--immersive">{renderStage(true)}</main>;
  }

  return (
    <main className="app-shell player-experience">
      <section className="hero-copy" aria-label="Resumo do jogo">
        <p className="eyebrow">MMORPG de navegador</p>
        <h1>Cara de Abelha</h1>
        <p className="hero-text">
          Entre com seu username, confira a arena inicial em formato compacto e use o clique de entrada para abrir a aventura em tela cheia quando estiver pronto.
        </p>
      </section>

      <section className="experience-card" aria-label="Entrada do jogador">
        {renderStage(false)}
      </section>
    </main>
  );
}