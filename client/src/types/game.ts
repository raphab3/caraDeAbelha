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

// Map zone metadata - defines spatial boundaries of game regions
export interface MapZone {
  id: string;
  name: string;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
}

// Transition point between zones - metadata for progression flow
export interface MapTransition {
  fromZone: string;
  toZone: string;
  x: number;
  z: number;
  type: "gate" | "portal" | "passage";
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

export interface CollectFlowerAction {
  type: "collect_flower";
  nodeId: string;
}

export interface DepositAction {
  type: "deposit_honey";
}

export interface UnlockZoneAction {
  type: "unlock_zone";
  zoneId: string;
}

export type ClientMessage = MoveAction | MoveToAction | RespawnAction | CollectFlowerAction | DepositAction | UnlockZoneAction;

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

// Zone info within zone state - metadata about a zone including unlock cost and boundaries
export interface ZoneInfo {
  id: string;
  name: string;
  costHoney: number;
  isUnlocked: boolean;
  prerequisites: string[];
  boundaryX1: number;
  boundaryX2: number;
  boundaryY1: number;
  boundaryY2: number;
}

// Zone state message from server - exposes minimal zone metadata and unlock status
export interface ZoneStateMessage {
  type: "zone_state";
  zones: ZoneInfo[];
  unlockedZoneIds: string[];
}

export type ServerMessage = SessionMessage | WorldStateMessage | PlayerStatusMessage | InteractionResult | ZoneStateMessage;

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
  zones?: MapZone[];
  transitions?: MapTransition[];
  zoneState?: ZoneStateMessage;
  error?: string;
}

export interface GameSessionController extends GameSessionState {
  moveToTarget: (x: number, z: number) => void;
  respawn: () => void;
  sendAction: (action: ClientMessage) => void;
}

export interface RenderPerformanceSnapshot {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}