import { useEffect, useState } from "react";

import { DisconnectModal } from "../DisconnectModal";
import { GameViewport } from "../GameViewport";
import { LoginGate } from "../LoginGate";
import { PwaInstallPrompt } from "../PwaInstallPrompt";
import { SettingsDock } from "./SettingsDock";
import { GameHUD } from "../../game/hud";
import { useFullscreenTarget } from "../../hooks/useFullscreenTarget";
import { useGameSession } from "../../hooks/useGameSession";
import { useStageBgm } from "../../hooks/useStageBgm";
import styles from "./PlayerExperience.module.css";

const USERNAME_STORAGE_KEY = "cara-de-abelha.username";
const AUDIO_MUTED_STORAGE_KEY = "cara-de-abelha.audio-muted";

function readStoredUsername(): string {
  return window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() ?? "";
}

function readStoredAudioMuted(): boolean {
  return window.localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === "true";
}

function ignoreRenderPerformance(): void {}

export default function PlayerExperience() {
  const [draftUsername, setDraftUsername] = useState(readStoredUsername);
  const [activeUsername, setActiveUsername] = useState<string>();
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [formError, setFormError] = useState<string>();
  const [hasJoinedSession, setHasJoinedSession] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(readStoredAudioMuted);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { targetRef, isFullscreen, isSupported, requestFullscreen, toggleFullscreen } =
    useFullscreenTarget<HTMLDivElement>();
  const gameSession = useGameSession(activeUsername, connectionAttempt);

  useStageBgm({
    enabled: hasJoinedSession && gameSession.connectionState === "connected",
    muted: isAudioMuted,
    src: gameSession.audioBgm,
  });

  useEffect(() => {
    window.localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, String(isAudioMuted));
  }, [isAudioMuted]);

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
    styles.shell,
    hasStartedAdventure ? styles.shellStarted : "",
    isFullscreen ? styles.shellImmersive : "",
  ]
    .filter(Boolean)
    .join(" ");

  function renderStage() {
    const stageClassName = isFullscreen
      ? [styles.stage, styles.stageImmersive, "w-screen h-screen overflow-hidden bg-black"].join(" ")
      : styles.stage;
    const viewportClassName = [
      styles.viewportShell,
      styles.viewportGameplay,
      isFullscreen ? styles.playerViewportShell : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={stageClassName} ref={targetRef}>
        {hasStartedAdventure ? (
          <div className={viewportClassName}>
            <GameViewport
              chunks={gameSession.chunks}
              chunkSize={gameSession.chunkSize}
              connectionState={gameSession.connectionState}
              flowerInteraction={gameSession.flowerInteraction}
              hiveInteraction={gameSession.hiveInteraction}
              landmarks={gameSession.landmarks}
              lastInteraction={gameSession.lastInteraction}
              localPlayerId={gameSession.localPlayerId}
              onClearTargets={gameSession.clearTargets}
              onFlowerClick={gameSession.targetFlower}
              onHiveClick={gameSession.targetHive}
              onMoveToTarget={gameSession.moveToTarget}
              onPerformanceChange={ignoreRenderPerformance}
              onRespawn={gameSession.respawn}
              players={gameSession.players}
              props={gameSession.props}
              renderDistance={gameSession.renderDistance}
            />
          </div>
        ) : (
          <div className={[viewportClassName, styles.previewShell].join(" ")}>
            <div className={styles.loginBackdrop} aria-hidden="true" />
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
            className={styles.fullscreenToggle}
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

        {hasStartedAdventure ? (
          <SettingsDock
            isAudioMuted={isAudioMuted}
            isOpen={isSettingsOpen}
            onExit={handleExit}
            onRequestClose={() => {
              setIsSettingsOpen(false);
            }}
            onToggleAudio={() => {
              setIsAudioMuted((current) => !current);
            }}
            onToggleOpen={() => {
              setIsSettingsOpen((current) => !current);
            }}
          />
        ) : null}

        {showGameHud ? (
          <GameHUD
            flowerInteraction={gameSession.flowerInteraction}
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
    setIsSettingsOpen(false);
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
    setIsSettingsOpen(false);
    setHasJoinedSession(false);
    setActiveUsername(undefined);
  }

  return (
    <main className={shellClassName}>
      {showHeroCopy ? (
        <section className={styles.heroCopy} aria-label="Resumo do jogo">
          <p className={styles.eyebrow}>MMORPG de navegador</p>
          <h1 className={styles.heroTitle}>Cara de Abelha</h1>
        </section>
      ) : null}

      <section className={styles.experienceCard} aria-label="Entrada do jogador">
        {!isFullscreen ? <PwaInstallPrompt /> : null}
        {renderStage()}
      </section>
    </main>
  );
}
