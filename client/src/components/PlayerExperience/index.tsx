import { useEffect, useState } from "react";

import { DisconnectModal } from "../DisconnectModal";
import { GameViewport } from "../GameViewport";
import { LoginGate } from "../LoginGate";
import { PwaInstallPrompt } from "../PwaInstallPrompt";
import { GameHUD } from "../../game/hud";
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
  const [hasJoinedSession, setHasJoinedSession] = useState(false);
  const { targetRef, isFullscreen, isSupported, requestFullscreen, toggleFullscreen } =
    useFullscreenTarget<HTMLDivElement>();
  const gameSession = useGameSession(activeUsername, connectionAttempt);

  useEffect(() => {
    if (gameSession.connectionState !== "connected" || !gameSession.localUsername) {
      return;
    }

    window.localStorage.setItem(USERNAME_STORAGE_KEY, gameSession.localUsername);
  }, [gameSession.connectionState, gameSession.localUsername]);

  useEffect(() => {
    if (!activeUsername) {
      setHasJoinedSession(false);
      return;
    }

    if (gameSession.localPlayerId) {
      setHasJoinedSession(true);
    }
  }, [activeUsername, gameSession.localPlayerId]);

  const loginError =
    formError ??
    (activeUsername && gameSession.connectionState === "disconnected" && !hasJoinedSession ? gameSession.error : undefined);

  const hasStartedAdventure = Boolean(activeUsername);
  const showDisconnectModal = hasJoinedSession && gameSession.connectionState === "disconnected";
  const showLoginGate = !showDisconnectModal && !gameSession.localPlayerId && !hasJoinedSession;
  const showGameHud = hasStartedAdventure && !showDisconnectModal;
  const showHeroCopy = !hasStartedAdventure;
  const shellClassName = [
    "app-shell player-experience",
    hasStartedAdventure ? "player-experience--started" : "",
    isFullscreen ? "player-experience--immersive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function renderStage() {
    const stageClassName = isFullscreen
      ? "experience-stage player-experience__stage player-experience__stage--immersive w-screen h-screen overflow-hidden bg-black"
      : "experience-stage player-experience__stage";
    const viewportClassName = isFullscreen ? "viewport-shell player-viewport-shell" : "viewport-shell";

    return (
      <div className={stageClassName} ref={targetRef}>
        {hasStartedAdventure ? (
          <div className={viewportClassName}>
            <GameViewport
              chunks={gameSession.chunks}
              chunkSize={gameSession.chunkSize}
              connectionState={gameSession.connectionState}
              localPlayerId={gameSession.localPlayerId}
              onFlowerClick={(flower) => gameSession.moveToTarget(flower.x, flower.y)}
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

        {showDisconnectModal ? (
          <DisconnectModal
            error={gameSession.error}
            onExit={handleExit}
            onReconnect={handleReconnect}
            username={gameSession.localUsername ?? activeUsername}
          />
        ) : null}

        {hasStartedAdventure && isSupported ? (
          <button
            aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
            aria-pressed={isFullscreen}
            className="viewport-fullscreen-toggle !w-12 !h-12 flex items-center justify-center !p-0"
            onClick={() => {
              void toggleFullscreen();
            }}
            type="button"
            title={isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {isFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8M9 19.8V15m0 0H4.2M9 15l-6 6M15 4.2V9m0 0h4.8M15 9l6-6M9 4.2V9m0 0H4.2M9 9 3 3"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8M3 16.2V21m0 0h4.8M3 21l6-6M21 7.8V3m0 0h-4.8M21 3l-6 6M3 7.8V3m0 0h4.8M3 3l6 6"/>
              </svg>
            )}
          </button>
        ) : null}

        {showGameHud ? (
          <GameHUD
            gameSessionController={gameSession}
            lastInteraction={gameSession.lastInteraction}
            lockedZoneId={undefined}
            playerProgress={gameSession.playerProgress}
          />
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
    if (isSupported) {
      void requestFullscreen();
    }
    setConnectionAttempt((current) => current + 1);
    setActiveUsername(normalizedUsername);
  }

  function handleReconnect() {
    if (!activeUsername) {
      return;
    }

    setFormError(undefined);
    if (isSupported && !isFullscreen) {
      void requestFullscreen();
    }

    setConnectionAttempt((current) => current + 1);
  }

  function handleExit() {
    setFormError(undefined);
    setHasJoinedSession(false);
    setActiveUsername(undefined);
  }

  return (
    <main className={shellClassName}>
      {showHeroCopy ? (
        <section className="hero-copy" aria-label="Resumo do jogo">
          <p className="eyebrow">MMORPG de navegador</p>
          <h1>Cara de Abelha</h1>
        </section>
      ) : null}

      <section className="experience-card" aria-label="Entrada do jogador">
        {!isFullscreen ? <PwaInstallPrompt /> : null}
        {renderStage()}
      </section>
    </main>
  );
}