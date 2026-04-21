export interface HealthStatusResponse {
  status: string;
  service: string;
  timestamp: string;
}

export interface HealthStatusState {
  state: "loading" | "online" | "offline";
  service?: string;
  updatedAt?: string;
  latencyMs?: number;
  error?: string;
}

export interface ServerMetricsResponse {
  status: string;
  service: string;
  timestamp: string;
  activePlayers: number;
  tick: number;
}

export interface ServerMetricsState {
  state: "loading" | "online" | "offline";
  service?: string;
  updatedAt?: string;
  activePlayers: number;
  tick: number;
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
  groundY?: number;
  scale: number;
  petalColor: string;
  coreColor: string;
}

export interface WorldHiveState {
  id: string;
  x: number;
  y: number;
  groundY?: number;
  scale: number;
  toneColor: string;
  glowColor: string;
}

export interface WorldTileState {
  id: string;
  x: number;
  y: number;
  z: number;
  type: "grass" | "water" | "stone";
}

export interface WorldTreeState {
  id: string;
  x: number;
  y: number;
  groundY?: number;
  scale: number;
}

export interface WorldChunkState {
  key: string;
  x: number;
  y: number;
  tiles: WorldTileState[];
  flowers: WorldFlowerState[];
  trees: WorldTreeState[];
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

export interface HeartbeatMessage {
  type: "heartbeat";
  timestamp: string;
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

export interface HeartbeatAction {
  type: "heartbeat";
}

export type ClientMessage = MoveAction | MoveToAction | RespawnAction | HeartbeatAction;
export type ServerMessage = SessionMessage | WorldStateMessage | HeartbeatMessage;

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