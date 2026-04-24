import { useEffect, useRef, useState } from "react";

import { WS_URL } from "../game/env";
import { DEFAULT_SKILL_CATALOG, SKILL_SLOT_COUNT } from "../game/skillCatalog";
import { normalizePlayerProgressState, playerProgressFromStatus } from "../game/skillState";
import { WSClient } from "../game/WSClient";
import type {
  ClientMessage,
  FlowerInteractionState,
  GameSessionController,
  GameSessionState,
  HiveInteractionState,
  InteractionResult,
  PlayerStatusMessage,
  SessionMessage,
  WorldHiveState,
  WorldStateMessage,
  SkillEffectState,
  SkillEffectsMessage,
  WorldChunkState,
  WorldFlowerState,
  WorldPlayerState,
  ZoneStateMessage,
} from "../types/game";

const DEFAULT_DISCONNECT_ERROR = "A conexao com o jardim ficou sem resposta. Tente reconectar.";
const OFFLINE_DISCONNECT_ERROR = "Sua internet ficou offline. Tente reconectar para voltar ao jardim.";
const WS_CONNECT_ERROR = "Falha ao conectar no websocket do jogo.";
const FLOWER_COLLECT_RADIUS = 0.65;
const FLOWER_TARGET_SNAP_DISTANCE = 0.45;
const FLOWER_TARGET_GRACE_MS = 1200;
const HIVE_TARGET_SNAP_DISTANCE = 0.65;
const HIVE_TARGET_GRACE_MS = 1500;

function createDefaultPlayerProgress() {
  return normalizePlayerProgressState({
    pollenCarried: 0,
    pollenCapacity: 40,
    honey: 0,
    level: 1,
    xp: 0,
    skillPoints: 0,
    currentZoneId: "zone:starter_meadow",
    unlockedZoneIds: ["zone:starter_meadow"],
    ownedSkillIds: [],
    equippedSkills: Array.from({ length: SKILL_SLOT_COUNT }, () => ""),
    skillRuntime: Array.from({ length: SKILL_SLOT_COUNT }, (_, slot) => ({
      slot,
      skillId: "",
      state: "ready" as const,
      cooldownEndsAt: 0,
    })),
    skillCatalog: DEFAULT_SKILL_CATALOG,
  });
}

function createInitialState(
  connectionState: GameSessionState["connectionState"],
  localUsername?: string,
): GameSessionState {
  return {
    connectionState,
    localUsername,
    props: [],
    landmarks: [],
    players: [],
    chunks: [],
    centerChunkX: 0,
    centerChunkY: 0,
    renderDistance: 0,
    chunkSize: 0,
    tick: 0,
    skillEffects: [],
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

function isSkillEffectsMessage(message: unknown): message is SkillEffectsMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  return "type" in message && message.type === "skill_effects";
}

function mergeSkillEffects(current: SkillEffectState[], incoming: SkillEffectState[]): SkillEffectState[] {
  const now = Date.now();
  const byId = new Map(current.filter((effect) => effect.expiresAt > now).map((effect) => [effect.id, effect]));

  for (const effect of incoming) {
    if (effect.expiresAt <= now) {
      byId.delete(effect.id);
      continue;
    }

    byId.set(effect.id, effect);
  }

  return Array.from(byId.values()).sort((left, right) => left.expiresAt - right.expiresAt);
}

function resolveDisconnectError(reason?: string): string {
  const normalizedReason = reason?.trim();
  return normalizedReason ? normalizedReason : DEFAULT_DISCONNECT_ERROR;
}

function isCollectingPreview(interaction: InteractionResult): boolean {
  return interaction.action === "collect_flower" && interaction.reason.startsWith("Coletando flor");
}

function hasMoveTarget(player: WorldPlayerState): player is WorldPlayerState & { targetX: number; targetY: number } {
  return player.targetX !== undefined && player.targetY !== undefined;
}

function findFlowerById(chunks: WorldChunkState[], flowerId: string): WorldFlowerState | undefined {
  for (const chunk of chunks) {
    const flower = chunk.flowers.find((item) => item.id === flowerId);
    if (flower) {
      return flower;
    }
  }

  return undefined;
}

function findHiveById(chunks: WorldChunkState[], hiveId: string): WorldHiveState | undefined {
  for (const chunk of chunks) {
    const hive = chunk.hives.find((item) => item.id === hiveId);
    if (hive) {
      return hive;
    }
  }

  return undefined;
}

function resolveFlowerInteraction(
  current: FlowerInteractionState | undefined,
  localPlayerId: string | undefined,
  players: WorldPlayerState[],
  chunks: WorldChunkState[],
): FlowerInteractionState | undefined {
  if (!current || !localPlayerId) {
    return undefined;
  }

  const localPlayer = players.find((player) => player.id === localPlayerId);
  if (!localPlayer) {
    return current;
  }

  const flower = findFlowerById(chunks, current.flowerId);
  if (!flower) {
    return undefined;
  }

  const distanceToFlower = Math.hypot(localPlayer.x - flower.x, localPlayer.y - flower.y);
  if (distanceToFlower <= FLOWER_COLLECT_RADIUS) {
    return {
      ...current,
      flowerX: flower.x,
      flowerY: flower.y,
      phase: "collecting",
    };
  }

  if (hasMoveTarget(localPlayer)) {
    const distanceToTarget = Math.hypot(localPlayer.targetX - flower.x, localPlayer.targetY - flower.y);
    if (distanceToTarget <= FLOWER_TARGET_SNAP_DISTANCE) {
      return {
        ...current,
        flowerX: flower.x,
        flowerY: flower.y,
        phase: "moving",
      };
    }
  }

  if (Date.now() - current.startedAt <= FLOWER_TARGET_GRACE_MS) {
    return {
      ...current,
      flowerX: flower.x,
      flowerY: flower.y,
      phase: "moving",
    };
  }

  return undefined;
}

function resolveHiveInteraction(
  current: HiveInteractionState | undefined,
  localPlayerId: string | undefined,
  players: WorldPlayerState[],
  chunks: WorldChunkState[],
): HiveInteractionState | undefined {
  if (!current || !localPlayerId) {
    return undefined;
  }

  const localPlayer = players.find((player) => player.id === localPlayerId);
  if (!localPlayer) {
    return current;
  }

  const hive = findHiveById(chunks, current.hiveId);
  if (!hive) {
    return undefined;
  }

  if (hasMoveTarget(localPlayer)) {
    const distanceToTarget = Math.hypot(localPlayer.targetX - hive.x, localPlayer.targetY - hive.y);
    if (distanceToTarget <= HIVE_TARGET_SNAP_DISTANCE) {
      return {
        ...current,
        hiveX: hive.x,
        hiveY: hive.y,
      };
    }
  }

  if (Date.now() - current.startedAt <= HIVE_TARGET_GRACE_MS) {
    return {
      ...current,
      hiveX: hive.x,
      hiveY: hive.y,
    };
  }

  return undefined;
}

export function useGameSession(username?: string, reconnectKey = 0): GameSessionController {
  const [gameSession, setGameSession] = useState<GameSessionState>(createInitialState("idle"));
  const clientRef = useRef<WSClient | null>(null);
  const skillEffectTimeoutsRef = useRef<Map<string, number>>(new Map());

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

    const scheduleSkillEffectCleanup = (effect: SkillEffectState) => {
      const remainingMs = Math.max(0, effect.expiresAt - Date.now());
      const existingTimeoutId = skillEffectTimeoutsRef.current.get(effect.id);
      if (existingTimeoutId !== undefined) {
        window.clearTimeout(existingTimeoutId);
      }

      const timeoutId = window.setTimeout(() => {
        skillEffectTimeoutsRef.current.delete(effect.id);
        setGameSession((current) => ({
          ...current,
          skillEffects: current.skillEffects.filter((item) => item.id !== effect.id),
        }));
      }, remainingMs + 32);

      skillEffectTimeoutsRef.current.set(effect.id, timeoutId);
    };

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
            playerProgress: playerProgressFromStatus(message),
          }));
          return;
        }

        if (isInteractionResultMessage(message)) {
          if (message.action === "use_skill" && message.success) {
            return;
          }

          setGameSession((current) => ({
            ...current,
            flowerInteraction:
              (message.action === "collect_flower" && !isCollectingPreview(message)) || message.action === "failed_collection"
                ? undefined
                : current.flowerInteraction,
            hiveInteraction: message.action === "deposit_honey" ? undefined : current.hiveInteraction,
            lastInteraction: message,
          }));

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

        if (isSkillEffectsMessage(message)) {
          const activeEffects = message.effects.filter((effect) => effect.expiresAt > Date.now());
          activeEffects.forEach(scheduleSkillEffectCleanup);
          setGameSession((current) => ({
            ...current,
            skillEffects: mergeSkillEffects(current.skillEffects, activeEffects),
          }));
          return;
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
          stageId: message.stageId,
          stageName: message.stageName,
          audioBgm: message.audioBgm,
          players: message.players,
          chunks: message.chunks,
          props: message.props ?? [],
          landmarks: message.landmarks ?? [],
          centerChunkX: message.centerChunkX,
          centerChunkY: message.centerChunkY,
          renderDistance: message.renderDistance,
          chunkSize: message.chunkSize,
          tick: message.tick,
          flowerInteraction: resolveFlowerInteraction(
            current.flowerInteraction,
            current.localPlayerId,
            message.players,
            message.chunks,
          ),
          hiveInteraction: resolveHiveInteraction(
            current.hiveInteraction,
            current.localPlayerId,
            message.players,
            message.chunks,
          ),
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

      for (const timeoutId of skillEffectTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      skillEffectTimeoutsRef.current.clear();

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

  const targetFlower = (flower: WorldFlowerState) => {
    setGameSession((current) => ({
      ...current,
      flowerInteraction: {
        flowerId: flower.id,
        flowerX: flower.x,
        flowerY: flower.y,
        startedAt: Date.now(),
        phase: "moving",
      },
      hiveInteraction: undefined,
    }));

    moveToTarget(flower.x, flower.y);
  };

  const targetHive = (hive: WorldHiveState) => {
    setGameSession((current) => ({
      ...current,
      flowerInteraction: undefined,
      hiveInteraction: {
        hiveId: hive.id,
        hiveX: hive.x,
        hiveY: hive.y,
        startedAt: Date.now(),
      },
    }));

    moveToTarget(hive.x, hive.y);
  };

  const clearTargets = () => {
    setGameSession((current) => ({
      ...current,
      flowerInteraction: undefined,
      hiveInteraction: undefined,
    }));
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
    targetFlower,
    targetHive,
    clearTargets,
    respawn,
    sendAction,
  };
}