export interface HealthStatusResponse {
  status: string;
  service: string;
  timestamp: string;
}

export interface HealthStatusState {
  state: "loading" | "online" | "offline";
  service?: string;
  updatedAt?: string;
  error?: string;
}

export interface WorldPlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  speed: number;
}

export interface WorldFlowerState {
  id: string;
  x: number;
  y: number;
  scale: number;
  petalColor: string;
  coreColor: string;
}

export interface WorldHiveState {
  id: string;
  x: number;
  y: number;
  scale: number;
  toneColor: string;
  glowColor: string;
}

export interface WorldChunkState {
  key: string;
  x: number;
  y: number;
  flowers: WorldFlowerState[];
  hives: WorldHiveState[];
}

export interface WorldStateMessage {
  type: "state";
  tick: number;
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  centerChunkX: number;
  centerChunkY: number;
  renderDistance: number;
  chunkSize: number;
}

export interface SessionMessage {
  type: "session";
  playerId: string;
  username: string;
}

export type MoveDirection = "up" | "down" | "left" | "right";

export interface MoveAction {
  type: "move";
  dir: MoveDirection;
}

export interface MoveToAction {
  type: "move_to";
  x: number;
  z: number;
}

export interface RespawnAction {
  type: "respawn";
}

export type ClientMessage = MoveAction | MoveToAction | RespawnAction;
export type ServerMessage = SessionMessage | WorldStateMessage;

export interface GameSessionState {
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
  localPlayerId?: string;
  localUsername?: string;
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  centerChunkX: number;
  centerChunkY: number;
  renderDistance: number;
  chunkSize: number;
  tick: number;
  error?: string;
}

export interface GameSessionController extends GameSessionState {
  moveToTarget: (x: number, z: number) => void;
  respawn: () => void;
}

export interface RenderPerformanceSnapshot {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}