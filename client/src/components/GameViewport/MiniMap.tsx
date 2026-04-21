import { useMemo } from "react";

import type { WorldChunkState, WorldPlayerState } from "../../types/game";

const MIN_WORLD_SPAN = 18;
const MAP_PADDING = 3;

interface MiniMapProps {
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  chunkSize: number;
  localPlayerId?: string;
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

export function MiniMap({ players, chunks, chunkSize, localPlayerId }: MiniMapProps) {
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
  const showLabels = markers.length <= 5;
  const localCoordinates = useMemo<CoordinateReadout>(() => {
    return {
      latitudeLabel: formatLatitude(localPlayer?.y ?? 0),
      longitudeLabel: formatLongitude(localPlayer?.x ?? 0),
    };
  }, [localPlayer?.x, localPlayer?.y]);

  return (
    <aside className="mini-map" aria-label="Mini mapa dos jogadores">
      <div className="mini-map__header">
        <div>
          <p className="mini-map__eyebrow">radar</p>
          <strong>{markers.length} jogadores</strong>
        </div>
        <span className="mini-map__bounds">janela {Math.round(bounds.width)}m</span>
      </div>

      <div className="mini-map__surface" aria-hidden="true">
        <div className="mini-map__grid" />
        <span className="mini-map__axis mini-map__axis--top">lat {formatLatitude(bounds.maxY)}</span>
        <span className="mini-map__axis mini-map__axis--bottom">lat {formatLatitude(bounds.minY)}</span>
        <span className="mini-map__axis mini-map__axis--left">long {formatLongitude(bounds.minX)}</span>
        <span className="mini-map__axis mini-map__axis--right">long {formatLongitude(bounds.maxX)}</span>

        {markers.map((player) => (
          <div
            key={player.id}
            className={`mini-map__marker${player.isLocal ? " mini-map__marker--local" : ""}`}
            style={{ left: `${player.left}%`, top: `${player.top}%` }}
          >
            <span className="mini-map__dot" />
            {showLabels ? <span className="mini-map__label">{player.username}</span> : null}
          </div>
        ))}
      </div>

      <div className="mini-map__coordinates" aria-label="Coordenadas atuais">
        <span>lat {localCoordinates.latitudeLabel}</span>
        <span>long {localCoordinates.longitudeLabel}</span>
      </div>

      <p className="mini-map__summary">
        {nearbyPlayers.length > 0
          ? `Procure por ${nearbyPlayers.map((player) => player.username).join(", ")}.`
          : "Nenhum outro jogador entrou no seu radar ainda."}
      </p>
    </aside>
  );
}