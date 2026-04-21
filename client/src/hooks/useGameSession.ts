import { useEffect, useRef, useState } from "react";

import { WS_URL } from "../game/env";
import { WSClient } from "../game/WSClient";
import type { GameSessionState, MoveDirection, WorldStateMessage } from "../types/game";

const INITIAL_STATE: GameSessionState = {
  connectionState: "connecting",
  players: [],
  tick: 0,
};

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

export function useGameSession(): GameSessionState {
  const [gameSession, setGameSession] = useState<GameSessionState>(INITIAL_STATE);
  const clientRef = useRef<WSClient | null>(null);
  const pressedDirectionsRef = useRef<MoveDirection[]>([]);

  useEffect(() => {
    const client = new WSClient(WS_URL);
    clientRef.current = client;

    client.connect({
      onOpen: () => {
        setGameSession((current) => ({
          ...current,
          connectionState: "connected",
          error: undefined,
        }));
      },
      onMessage: (message) => {
        if (!isWorldStateMessage(message)) {
          return;
        }

        setGameSession({
          connectionState: "connected",
          players: message.players,
          tick: message.tick,
        });
      },
      onClose: () => {
        setGameSession((current) => ({
          ...current,
          connectionState: "disconnected",
        }));
      },
      onError: () => {
        setGameSession((current) => ({
          ...current,
          connectionState: "disconnected",
          error: "falha ao conectar no websocket do jogo",
        }));
      },
    });

    return () => {
      pressedDirectionsRef.current = [];
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const syncPressedDirection = (direction: MoveDirection, pressed: boolean) => {
      const directions = pressedDirectionsRef.current.filter((value) => value !== direction);
      if (pressed) {
        directions.push(direction);
      }

      pressedDirectionsRef.current = directions;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key.toLowerCase()];
      if (!direction) {
        return;
      }

      event.preventDefault();
      syncPressedDirection(direction, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
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

  return gameSession;
}