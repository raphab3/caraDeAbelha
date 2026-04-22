import { useEffect, useRef, useState } from "react";

import { WS_URL } from "../game/env";
import { WSClient } from "../game/WSClient";
import type {
  ClientMessage,
  GameSessionController,
  GameSessionState,
  InteractionResult,
  PlayerStatusMessage,
  SessionMessage,
  WorldStateMessage,
  ZoneStateMessage,
} from "../types/game";

const DEFAULT_DISCONNECT_ERROR = "A conexao com o jardim ficou sem resposta. Tente reconectar.";
const OFFLINE_DISCONNECT_ERROR = "Sua internet ficou offline. Tente reconectar para voltar ao jardim.";
const WS_CONNECT_ERROR = "Falha ao conectar no websocket do jogo.";

function createDefaultPlayerProgress() {
  return {
    pollenCarried: 0,
    pollenCapacity: 40,
    honey: 0,
    level: 1,
    xp: 0,
    skillPoints: 0,
    currentZoneId: "zone_0",
    unlockedZoneIds: ["zone_0"],
  };
}

function createInitialState(
  connectionState: GameSessionState["connectionState"],
  localUsername?: string,
): GameSessionState {
  return {
    connectionState,
    localUsername,
    players: [],
    chunks: [],
    centerChunkX: 0,
    centerChunkY: 0,
    renderDistance: 0,
    chunkSize: 0,
    tick: 0,
  };
}

function isWorldStateMessage(message: unknown): message is WorldStateMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "state";
}

function isSessionMessage(message: unknown): message is SessionMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "session";
}

function isPlayerStatusMessage(message: unknown): message is PlayerStatusMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "player_status";
}

function isInteractionResultMessage(message: unknown): message is InteractionResult {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "interaction_result";
}

function isZoneStateMessage(message: unknown): message is ZoneStateMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "zone_state";
}

function resolveDisconnectError(reason?: string): string {
  const normalizedReason = reason?.trim();
  return normalizedReason ? normalizedReason : DEFAULT_DISCONNECT_ERROR;
}

export function useGameSession(username?: string, reconnectKey = 0): GameSessionController {
  const [gameSession, setGameSession] = useState<GameSessionState>(createInitialState("idle"));
  const clientRef = useRef<WSClient | null>(null);

  useEffect(() => {
    if (!username) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      setGameSession(createInitialState("idle"));
      return;
    }

    const socketUrl = new URL(WS_URL);
    socketUrl.searchParams.set("username", username);

    const client = new WSClient(socketUrl.toString());
    let active = true;

    const disconnectSession = (reason?: string) => {
      if (!active) {
        return;
      }

      setGameSession((current) => {
        const error = current.error ?? resolveDisconnectError(reason);
        const localUsername = current.localUsername ?? username;

        if (
          current.connectionState === "disconnected" &&
          current.localUsername === localUsername &&
          current.error === error &&
          current.players.length === 0 &&
          current.chunks.length === 0
        ) {
          return current;
        }

        return {
          ...createInitialState("disconnected", localUsername),
          error,
        };
      });
    };

    clientRef.current = client;
    setGameSession(createInitialState("connecting", username));

    client.connect({
      onOpen: () => {
        if (!active) {
          return;
        }

        setGameSession((current) => ({
          ...current,
          connectionState: "connected",
          error: undefined,
        }));
      },
      onMessage: (message) => {
        if (!active) {
          return;
        }

        if (isSessionMessage(message)) {
          setGameSession((current) => ({
            ...current,
            localPlayerId: message.playerId,
            localUsername: message.username,
            playerProgress: current.playerProgress ?? createDefaultPlayerProgress(),
          }));
          return;
        }

        if (isPlayerStatusMessage(message)) {
          setGameSession((current) => ({
            ...current,
            playerProgress: {
              pollenCarried: message.pollenCarried,
              pollenCapacity: message.pollenCapacity,
              honey: message.honey,
              level: message.level,
              xp: message.xp,
              skillPoints: message.skillPoints,
              currentZoneId: message.currentZoneId,
              unlockedZoneIds: message.unlockedZoneIds,
            },
          }));
          return;
        }

        if (isInteractionResultMessage(message)) {
          setGameSession((current) => ({
            ...current,
            lastInteraction: message,
          }));

          // Clear interaction feedback after 3 seconds
          const timeoutId = window.setTimeout(() => {
            setGameSession((current) => ({
              ...current,
              lastInteraction: undefined,
            }));
          }, 3000);

          return () => {
            window.clearTimeout(timeoutId);
          };
        }

        if (isZoneStateMessage(message)) {
          setGameSession((current) => ({
            ...current,
            zoneState: message,
          }));
          return;
        }

        if (!isWorldStateMessage(message)) {
          return;
        }

        setGameSession((current) => ({
          ...current,
          connectionState: "connected",
          players: message.players,
          chunks: message.chunks,
          centerChunkX: message.centerChunkX,
          centerChunkY: message.centerChunkY,
          renderDistance: message.renderDistance,
          chunkSize: message.chunkSize,
          tick: message.tick,
          error: undefined,
        }));
      },
      onClose: (event) => {
        if (!active) {
          return;
        }

        disconnectSession(event.reason);
      },
      onError: () => {
        if (!active) {
          return;
        }

        disconnectSession(WS_CONNECT_ERROR);
        client.disconnect();
      },
    });

    const handleOffline = () => {
      disconnectSession(OFFLINE_DISCONNECT_ERROR);
      client.disconnect();
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      window.removeEventListener("offline", handleOffline);
      client.disconnect();

      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [reconnectKey, username]);

  const moveToTarget = (x: number, z: number) => {
    clientRef.current?.send({
      type: "move_to",
      x,
      z,
    });
  };

  const respawn = () => {
    clientRef.current?.send({
      type: "respawn",
    });
  };

  const sendAction = (action: ClientMessage) => {
    clientRef.current?.send(action);
  };

  return {
    ...gameSession,
    moveToTarget,
    respawn,
    sendAction,
  };
}