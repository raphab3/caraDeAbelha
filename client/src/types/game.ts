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

export interface AdminPlayerSummaryDTO {
  id: string;
  username: string;
  online: boolean;
  lastSeenAt?: string;
}

export interface AdminPlayersResponse {
  status: string;
  service: string;
  timestamp: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  players: AdminPlayerSummaryDTO[];
}

export interface AdminPlayersState {
  state: "loading" | "online" | "offline";
  service?: string;
  updatedAt?: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  players: AdminPlayerSummaryDTO[];
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

// Player progression state: economy, levels, zones
export interface PlayerProgressState {
  pollenCarried: number;
  pollenCapacity: number;
  honey: number;
  level: number;
  xp: number;
  skillPoints: number;
  currentZoneId: string;
  unlockedZoneIds: string[];
}

// Result of a player interaction (collect, deposit, etc.)
export interface InteractionResult {
  type: "interaction_result";
  action: string; // "collect_flower", "deposit_pollen", etc.
  success: boolean;
  amount: number; // pollen/honey involved
  reason: string; // error message or empty string
  timestamp: number; // Unix milliseconds
}

// Player status update from server
export interface PlayerStatusMessage {
  type: "player_status";
  playerId: string;
  pollenCarried: number;
  pollenCapacity: number;
  honey: number;
  level: number;
  xp: number;
  skillPoints: number;
  currentZoneId: string;
  unlockedZoneIds: string[];
}

export type ServerMessage = SessionMessage | WorldStateMessage | PlayerStatusMessage | InteractionResult;

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
  playerProgress?: PlayerProgressState;
  lastInteraction?: InteractionResult;
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