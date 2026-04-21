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
  if (gameSession.connectionState === "idle") {
    return "aguardando username";
  }

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
  const activeWorldObjects = gameSession.chunks.reduce(
    (total, chunk) => total + chunk.flowers.length + chunk.hives.length,
    0,
  );

  return (
    <aside className="status-panel" aria-label="Estado atual do ambiente">
      <div className={statusClassName}>{getStatusLabel(backendHealth)}</div>

      <div className="status-grid">
        <article className="status-card">
          <h2>Infra pronta</h2>
          <p>Fog, chao em esteira e mundo por chunks ativos mantem a cena leve mesmo quando ela cresce.</p>
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
          <p>{gameSession.players.length} jogadores no raio visivel da sua abelha</p>
        </article>

        <article className="status-card">
          <h2>Chunks ativos</h2>
          <p>
            {gameSession.chunks.length} carregados com raio {gameSession.renderDistance} e chunk de {gameSession.chunkSize || "-"}
          </p>
        </article>

        <article className="status-card">
          <h2>Mundo visivel</h2>
          <p>{activeWorldObjects} flores e colmeias renderizadas agora</p>
        </article>

        <article className="status-card">
          <h2>Jogador local</h2>
          <p>{gameSession.localUsername ?? "username ainda nao escolhido"}</p>
        </article>

        <article className="status-card">
          <h2>Controles</h2>
          <p>Clique esquerdo no chao para mover. Use o botao direito para orbitar a camera.</p>
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