import { useMemo, useState } from "react";

import type { WorldChunkState, WorldPlayerState } from "../../types/game";

const MIN_WORLD_SPAN = 18;
const MAP_PADDING = 3;

interface MiniMapProps {
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  chunkSize: number;
  localPlayerId?: string;
  onPlayerClick?: (x: number, z: number) => void;
}

interface MiniMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface MiniMapMarker extends WorldPlayerState {
  isLocal: boolean;
  left: number;
  top: number;
}

interface CoordinateReadout {
  latitudeLabel: string;
  longitudeLabel: string;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function expandBounds(min: number, max: number): { min: number; max: number } {
  const span = Math.max(max - min, MIN_WORLD_SPAN);
  const center = (min + max) / 2;
  const halfSpan = span / 2 + MAP_PADDING;

  return {
    min: center - halfSpan,
    max: center + halfSpan,
  };
}

function formatLatitude(value: number): string {
  const rounded = Math.round(value);

  if (rounded === 0) {
    return "0 N";
  }

  return `${Math.abs(rounded)} ${rounded > 0 ? "N" : "S"}`;
}

function formatLongitude(value: number): string {
  const rounded = Math.round(value);

  if (rounded === 0) {
    return "0 E";
  }

  return `${Math.abs(rounded)} ${rounded > 0 ? "E" : "O"}`;
}

function resolveBounds(
  players: WorldPlayerState[],
  chunks: WorldChunkState[],
  chunkSize: number,
  localPlayer?: WorldPlayerState,
): MiniMapBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  if (chunks.length > 0 && chunkSize > 0) {
    for (const chunk of chunks) {
      minX = Math.min(minX, chunk.x * chunkSize);
      maxX = Math.max(maxX, (chunk.x + 1) * chunkSize);
      minY = Math.min(minY, chunk.y * chunkSize);
      maxY = Math.max(maxY, (chunk.y + 1) * chunkSize);
    }
  } else {
    for (const player of players) {
      minX = Math.min(minX, player.x);
      maxX = Math.max(maxX, player.x);
      minY = Math.min(minY, player.y);
      maxY = Math.max(maxY, player.y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    const anchorX = localPlayer?.x ?? 0;
    const anchorY = localPlayer?.y ?? 0;

    return {
      minX: anchorX - MIN_WORLD_SPAN / 2,
      maxX: anchorX + MIN_WORLD_SPAN / 2,
      minY: anchorY - MIN_WORLD_SPAN / 2,
      maxY: anchorY + MIN_WORLD_SPAN / 2,
      width: MIN_WORLD_SPAN,
      height: MIN_WORLD_SPAN,
    };
  }

  const horizontalBounds = expandBounds(minX, maxX);
  const verticalBounds = expandBounds(minY, maxY);

  return {
    minX: horizontalBounds.min,
    maxX: horizontalBounds.max,
    minY: verticalBounds.min,
    maxY: verticalBounds.max,
    width: horizontalBounds.max - horizontalBounds.min,
    height: verticalBounds.max - verticalBounds.min,
  };
}

export function MiniMap({ players, chunks, chunkSize, localPlayerId, onPlayerClick }: MiniMapProps) {
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );

  const bounds = useMemo(
    () => resolveBounds(players, chunks, chunkSize, localPlayer),
    [chunkSize, chunks, localPlayer, players],
  );

  const markers = useMemo<MiniMapMarker[]>(() => {
    return [...players]
      .sort((leftPlayer, rightPlayer) => {
        if (leftPlayer.id === localPlayerId) {
          return -1;
        }

        if (rightPlayer.id === localPlayerId) {
          return 1;
        }

        return leftPlayer.username.localeCompare(rightPlayer.username, "pt-BR");
      })
      .map((player) => ({
        ...player,
        isLocal: player.id === localPlayerId,
        left: clampPercent(((player.x - bounds.minX) / bounds.width) * 100),
        top: clampPercent((1 - (player.y - bounds.minY) / bounds.height) * 100),
      }));
  }, [bounds.height, bounds.minX, bounds.minY, bounds.width, localPlayerId, players]);

  const nearbyPlayers = markers.filter((player) => !player.isLocal);
  const localCoordinates = useMemo<CoordinateReadout>(() => {
    return {
      latitudeLabel: formatLatitude(localPlayer?.y ?? 0),
      longitudeLabel: formatLongitude(localPlayer?.x ?? 0),
    };
  }, [localPlayer?.x, localPlayer?.y]);

  return (
    <aside className="mini-map" aria-label="Mini mapa dos jogadores">
      <div className="mini-map__header">
        <div className="mini-map__header-left">
          <span className="mini-map__radar-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
              <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
              <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
              <line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            </svg>
          </span>
          <div>
            <p className="mini-map__eyebrow">radar</p>
            <strong className="mini-map__player-count">Jogadores ativos: {markers.length}</strong>
          </div>
        </div>
        <span className="mini-map__bounds">Janela: {Math.round(bounds.width)}m</span>
      </div>

      <div className="mini-map__surface" aria-hidden="true">
        <div className="mini-map__grid" />

        {/* Bússola */}
        <span className="mini-map__compass mini-map__compass--n">N</span>
        <span className="mini-map__compass mini-map__compass--s">S</span>
        <span className="mini-map__compass mini-map__compass--w">O</span>
        <span className="mini-map__compass mini-map__compass--e">L</span>

        {markers.map((player) =>
          player.isLocal ? (
            <div
              key={player.id}
              className="mini-map__marker mini-map__marker--local"
              style={{ left: `${player.left}%`, top: `${player.top}%` }}
            >
              <span className="mini-map__local-triangle" aria-label="Você" />
            </div>
          ) : (
            <button
              key={player.id}
              type="button"
              className={`mini-map__marker mini-map__marker--remote${hoveredPlayerId === player.id ? " mini-map__marker--hovered" : ""}`}
              style={{ left: `${player.left}%`, top: `${player.top}%` }}
              aria-label={`Ir até ${player.username} em lat ${formatLatitude(player.y)} long ${formatLongitude(player.x)}`}
              onClick={() => onPlayerClick?.(player.x, player.y)}
              onMouseEnter={() => setHoveredPlayerId(player.id)}
              onMouseLeave={() => setHoveredPlayerId(null)}
            >
              <span className="mini-map__dot" />
              <span className="mini-map__dot-pulse" />
              {hoveredPlayerId === player.id ? (
                <span className="mini-map__tooltip">
                  <strong>{player.username}</strong>
                  <span className="mini-map__tooltip-id">ID: {player.id.slice(0, 6)}</span>
                </span>
              ) : null}
            </button>
          ),
        )}

        {/* Linha do jogador local ao alvo mais próximo */}
        {localPlayer && nearbyPlayers.length > 0 && nearbyPlayers[0] ? (
          <svg className="mini-map__lines" aria-hidden="true">
            <line
              x1={`${markers.find((m) => m.isLocal)?.left ?? 50}%`}
              y1={`${markers.find((m) => m.isLocal)?.top ?? 50}%`}
              x2={`${nearbyPlayers[0].left}%`}
              y2={`${nearbyPlayers[0].top}%`}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          </svg>
        ) : null}
      </div>

      <div className="mini-map__footer">
        <div className="mini-map__coordinates" aria-label="Coordenadas atuais">
          <span className="mini-map__coord-icon" aria-hidden="true">📍</span>
          <span>
            Local do alvo:{" "}
            {nearbyPlayers.length > 0 && nearbyPlayers[0]
              ? `Lat ${formatLatitude(nearbyPlayers[0].y)} S, Long ${formatLongitude(nearbyPlayers[0].x)} E`
              : `Lat ${localCoordinates.latitudeLabel}, Long ${localCoordinates.longitudeLabel}`}
          </span>
        </div>

        <p className="mini-map__summary">
          {nearbyPlayers.length > 0
            ? <>Procure por{" "}{nearbyPlayers.map((player, index) => (
                <button
                  key={player.id}
                  type="button"
                  className="mini-map__name-link"
                  onClick={() => onPlayerClick?.(player.x, player.y)}
                >
                  {player.username}{index < nearbyPlayers.length - 1 ? ", " : ""}
                </button>
              ))}{" "}</>
            : "Nenhum outro jogador entrou no seu radar ainda."}
        </p>
      </div>
    </aside>
  );
}