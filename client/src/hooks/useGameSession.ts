import { useEffect, useRef, useState } from "react";

import { WS_URL } from "../game/env";
import { WSClient } from "../game/WSClient";
import type {
  GameSessionController,
  GameSessionState,
  MoveDirection,
  SessionMessage,
  WorldStateMessage,
} from "../types/game";

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

const KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function useGameSession(username?: string): GameSessionController {
  const [gameSession, setGameSession] = useState<GameSessionState>(createInitialState("idle"));
  const clientRef = useRef<WSClient | null>(null);
  const pressedDirectionsRef = useRef<MoveDirection[]>([]);

  useEffect(() => {
    if (!username) {
      pressedDirectionsRef.current = [];
      clientRef.current?.disconnect();
      clientRef.current = null;
      setGameSession(createInitialState("idle"));
      return;
    }

    const socketUrl = new URL(WS_URL);
    socketUrl.searchParams.set("username", username);

    const client = new WSClient(socketUrl.toString());
    let active = true;

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

        setGameSession((current) => ({
          connectionState: "disconnected",
          players: [],
          chunks: [],
          centerChunkX: 0,
          centerChunkY: 0,
          renderDistance: 0,
          chunkSize: 0,
          tick: 0,
          localUsername: current.localUsername ?? username,
          error: current.error ?? (event.reason || undefined),
        }));
      },
      onError: () => {
        if (!active) {
          return;
        }

        setGameSession((current) => ({
          ...current,
          connectionState: "disconnected",
          localPlayerId: undefined,
          localUsername: current.localUsername ?? username,
          error: "falha ao conectar no websocket do jogo",
        }));
      },
    });

    return () => {
      active = false;
      pressedDirectionsRef.current = [];
      client.disconnect();

      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [username]);

  useEffect(() => {
    const syncPressedDirection = (direction: MoveDirection, pressed: boolean) => {
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
      const direction = pressedDirectionsRef.current.at(-1);
      if (!direction) {
        return;
      }

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

  return {
    ...gameSession,
    moveToTarget,
  };
}