import type { GameSessionState, HealthStatusState } from "../../types/game";

interface StatusPanelProps {
  backendHealth: HealthStatusState;
  gameSession: GameSessionState;
  apiUrl: string;
  wsUrl: string;
}

function getStatusLabel(backendHealth: HealthStatusState): string {
  if (backendHealth.state === "loading") {
    return "checando backend";
  }

  if (backendHealth.state === "online") {
    return `backend online: ${backendHealth.service}`;
  }

  return `backend indisponivel: ${backendHealth.error}`;
}

function getConnectionLabel(gameSession: GameSessionState): string {
  if (gameSession.connectionState === "connecting") {
    return "conectando no websocket";
  }

  if (gameSession.connectionState === "connected") {
    return `ws conectado: tick ${gameSession.tick}`;
  }

  return gameSession.error ?? "websocket desconectado";
}

export function StatusPanel({ backendHealth, gameSession, apiUrl, wsUrl }: StatusPanelProps) {
  const statusClassName = `status-pill status-pill--${backendHealth.state}`;

  return (
    <aside className="status-panel" aria-label="Estado atual do ambiente">
      <div className={statusClassName}>{getStatusLabel(backendHealth)}</div>

      <div className="status-grid">
        <article className="status-card">
          <h2>Infra pronta</h2>
          <p>React, Three.js e React Three Fiber configurados em uma base minima para crescer por fases.</p>
        </article>

        <article className="status-card">
          <h2>API local</h2>
          <p>{apiUrl}</p>
        </article>

        <article className="status-card">
          <h2>WS ativo</h2>
          <p>{getConnectionLabel(gameSession)}</p>
        </article>

        <article className="status-card">
          <h2>Jogadores</h2>
          <p>{gameSession.players.length} conectados na cena autoritativa</p>
        </article>

        <article className="status-card">
          <h2>Jogador local</h2>
          <p>{gameSession.localPlayerId ?? "aguardando session do servidor"}</p>
        </article>

        <article className="status-card">
          <h2>Controles</h2>
          <p>Use WASD ou setas. O client envia apenas a intencao e o servidor responde com o novo estado.</p>
        </article>

        <article className="status-card">
          <h2>Ultimo ping</h2>
          <p>
            {backendHealth.updatedAt
              ? new Date(backendHealth.updatedAt).toLocaleTimeString("pt-BR")
              : "aguardando primeira resposta"}
          </p>
        </article>

        <article className="status-card">
          <h2>Endpoints</h2>
          <p>{apiUrl}</p>
          <p>{wsUrl}</p>
        </article>
      </div>
    </aside>
  );
}