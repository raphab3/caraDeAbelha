import { useEffect, useRef, useState } from "react";

import { WS_URL } from "../game/env";
import { WSClient } from "../game/WSClient";
import type {
  GameSessionController,
  GameSessionState,
  HeartbeatMessage,
  MoveDirection,
  SessionMessage,
  WorldPlayerState,
  WorldStateMessage,
} from "../types/game";

const CLIENT_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const CLIENT_SOCKET_TIMEOUT_MS = 60 * 1000;
const DEFAULT_DISCONNECT_ERROR = "A conexao com o jardim ficou sem resposta. Tente reconectar.";
const OFFLINE_DISCONNECT_ERROR = "Sua internet ficou offline. Tente reconectar para voltar ao jardim.";
const WS_CONNECT_ERROR = "Falha ao conectar no websocket do jogo.";

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

type RelativeMoveDirection = "forward" | "backward" | "left" | "right";

const KEY_TO_DIRECTION: Record<string, RelativeMoveDirection> = {
  arrowup: "forward",
  w: "forward",
  arrowdown: "backward",
  s: "backward",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

const CLOCKWISE_DIRECTIONS: MoveDirection[] = ["up", "right", "down", "left"];

function getHeadingDirection(player?: WorldPlayerState): MoveDirection | undefined {
  if (player?.targetX === undefined || player.targetY === undefined) {
    return undefined;
  }

  const deltaX = player.targetX - player.x;
  const deltaY = player.targetY - player.y;

  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
    return undefined;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? "right" : "left";
  }

  return deltaY > 0 ? "down" : "up";
}

function resolveRelativeDirection(
  inputDirection: RelativeMoveDirection,
  facingDirection: MoveDirection,
): MoveDirection {
  const facingIndex = CLOCKWISE_DIRECTIONS.indexOf(facingDirection);

  if (facingIndex === -1) {
    return "up";
  }

  switch (inputDirection) {
    case "forward":
      return CLOCKWISE_DIRECTIONS[facingIndex];
    case "backward":
      return CLOCKWISE_DIRECTIONS[(facingIndex + 2) % CLOCKWISE_DIRECTIONS.length];
    case "left":
      return CLOCKWISE_DIRECTIONS[(facingIndex + 3) % CLOCKWISE_DIRECTIONS.length];
    case "right":
      return CLOCKWISE_DIRECTIONS[(facingIndex + 1) % CLOCKWISE_DIRECTIONS.length];
  }
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

function isHeartbeatMessage(message: unknown): message is HeartbeatMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "heartbeat";
}

function resolveDisconnectError(reason?: string): string {
  const normalizedReason = reason?.trim();
  return normalizedReason ? normalizedReason : DEFAULT_DISCONNECT_ERROR;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function useGameSession(username?: string, reconnectKey = 0): GameSessionController {
  const [gameSession, setGameSession] = useState<GameSessionState>(createInitialState("idle"));
  const clientRef = useRef<WSClient | null>(null);
  const pressedDirectionsRef = useRef<RelativeMoveDirection[]>([]);
  const localPlayerRef = useRef<WorldPlayerState | undefined>(undefined);
  const facingDirectionRef = useRef<MoveDirection>("up");
  const lastPacketAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!username) {
      pressedDirectionsRef.current = [];
      localPlayerRef.current = undefined;
      facingDirectionRef.current = "up";
      lastPacketAtRef.current = null;
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

      pressedDirectionsRef.current = [];
      localPlayerRef.current = undefined;
      facingDirectionRef.current = "up";
      lastPacketAtRef.current = null;

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

        lastPacketAtRef.current = Date.now();

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

        lastPacketAtRef.current = Date.now();

        if (isHeartbeatMessage(message)) {
          setGameSession((current) => {
            if (current.connectionState === "connected" && current.error === undefined) {
              return current;
            }

            return {
              ...current,
              connectionState: "connected",
              error: undefined,
            };
          });
          return;
        }

        if (isSessionMessage(message)) {
          setGameSession((current) => ({
            ...current,
            localPlayerId: message.playerId,
            localUsername: message.username,
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

    const heartbeatIntervalId = window.setInterval(() => {
      client.send({
        type: "heartbeat",
      });
    }, CLIENT_HEARTBEAT_INTERVAL_MS);

    const connectionWatchdogId = window.setInterval(() => {
      const lastPacketAt = lastPacketAtRef.current;
      if (!active || lastPacketAt === null) {
        return;
      }

      if (Date.now() - lastPacketAt < CLIENT_SOCKET_TIMEOUT_MS) {
        return;
      }

      disconnectSession(DEFAULT_DISCONNECT_ERROR);
      client.disconnect();
    }, 1000);

    const handleOffline = () => {
      disconnectSession(OFFLINE_DISCONNECT_ERROR);
      client.disconnect();
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      pressedDirectionsRef.current = [];
      localPlayerRef.current = undefined;
      facingDirectionRef.current = "up";
      lastPacketAtRef.current = null;
      window.clearInterval(heartbeatIntervalId);
      window.clearInterval(connectionWatchdogId);
      window.removeEventListener("offline", handleOffline);
      client.disconnect();

      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [reconnectKey, username]);

  useEffect(() => {
    const localPlayer = gameSession.localPlayerId
      ? gameSession.players.find((player) => player.id === gameSession.localPlayerId)
      : undefined;

    localPlayerRef.current = localPlayer;

    const headingDirection = getHeadingDirection(localPlayer);
    if (headingDirection) {
      facingDirectionRef.current = headingDirection;
    }
  }, [gameSession.localPlayerId, gameSession.players]);

  useEffect(() => {
    const syncPressedDirection = (direction: RelativeMoveDirection, pressed: boolean) => {
      const directions = pressedDirectionsRef.current.filter((value) => value !== direction);
      if (pressed) {
        directions.push(direction);
      }

      pressedDirectionsRef.current = directions;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const direction = KEY_TO_DIRECTION[event.key.toLowerCase()];
      if (!direction) {
        return;
      }

      event.preventDefault();
      syncPressedDirection(direction, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const direction = KEY_TO_DIRECTION[event.key.toLowerCase()];
      if (!direction) {
        return;
      }

      syncPressedDirection(direction, false);
    };

    const handleBlur = () => {
      pressedDirectionsRef.current = [];
    };

    const intervalId = window.setInterval(() => {
      const inputDirection = pressedDirectionsRef.current.at(-1);
      if (!inputDirection) {
        return;
      }

      const headingDirection = getHeadingDirection(localPlayerRef.current);
      if (headingDirection) {
        facingDirectionRef.current = headingDirection;
      }

      const direction = resolveRelativeDirection(inputDirection, facingDirectionRef.current);

      clientRef.current?.send({
        type: "move",
        dir: direction,
      });
    }, 110);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

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

  return {
    ...gameSession,
    moveToTarget,
    respawn,
  };
}