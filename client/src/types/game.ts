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
  honey: number;
  lastSeenAt?: string;
}

export interface AdminPlayerHoneyUpdateResponse {
  status: string;
  service: string;
  timestamp: string;
  player: AdminPlayerSummaryDTO;
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

export interface AdminStageSummaryDTO {
  id: string;
  slug: string;
  displayName: string;
  status: "draft" | "published" | "active" | "archived" | string;
  activeVersionId?: string;
  latestVersionId?: string;
  latestVersion: number;
  checksum?: string;
  updatedAt: string;
  createdAt: string;
}

export interface AdminStageVersionDTO {
  id: string;
  stageId: string;
  version: number;
  checksum: string;
  storagePath?: string;
  sourceSizeBytes: number;
  validationStatus: "valid" | "invalid" | string;
  validationErrors: string[];
  createdAt: string;
  publishedAt?: string;
  activatedAt?: string;
  sourceJson?: string;
}

export interface AdminStagesResponse {
  status: string;
  service: string;
  timestamp: string;
  stages: AdminStageSummaryDTO[];
}

export interface AdminStageImportResponse {
  status: string;
  stage: AdminStageSummaryDTO;
  version: AdminStageVersionDTO;
}

export interface AdminStagesState {
  state: "loading" | "online" | "offline";
  service?: string;
  updatedAt?: string;
  stages: AdminStageSummaryDTO[];
  error?: string;
}

export interface WorldPlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  destinationX?: number;
  destinationY?: number;
  speed: number;
  currentLife: number;
  maxLife: number;
  isDead: boolean;
  combatTagUntil?: number;
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

export interface WorldPropState {
  id: string;
  prefabId: string;
  assetPath: string;
  category: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  zoneId?: string;
  tag?: string;
}

export interface WorldLandmarkState {
  id: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  zoneId?: string;
  tag?: string;
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
  stageId?: string;
  stageName?: string;
  audioBgm?: string;
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  props: WorldPropState[];
  landmarks: WorldLandmarkState[];
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

export interface BuySkillAction {
  type: "buy_skill";
  skillId: string;
}

export interface EquipSkillAction {
  type: "equip_skill";
  skillId: string;
  slot: number;
}

export interface UpgradeSkillAction {
  type: "upgrade_skill";
  skillId: string;
}

export interface UseSkillAction {
  type: "use_skill";
  slot: number;
}

export type ClientMessage =
  | MoveAction
  | MoveToAction
  | RespawnAction
  | CollectFlowerAction
  | DepositAction
  | UnlockZoneAction
  | BuySkillAction
  | EquipSkillAction
  | UpgradeSkillAction
  | UseSkillAction;

export interface SkillCatalogEntry {
  id: string;
  name: string;
  role: string;
  summary: string;
  costHoney: number;
  energyCostPollen: number;
  baseCooldownMs: number;
  basePower: number;
  baseDistance: number;
  maxUpgradeLevel: number;
}

export interface SkillUpgradeState {
  skillId: string;
  level: number;
  maxLevel: number;
  currentCooldownMs: number;
  currentPower: number;
  currentDistance: number;
  nextCooldownMs: number;
  nextPower: number;
  nextDistance: number;
  nextUpgradeCost: number;
  canUpgrade: boolean;
}

export interface PlayerSkillRuntimeState {
  slot: number;
  skillId: string;
  state: "ready" | "cooldown";
  cooldownEndsAt: number;
}

export interface SkillEffectState {
  id: string;
  ownerPlayerId: string;
  skillId: string;
  slot: number;
  stageId: string;
  kind: "dash" | "projectile" | "ground-area" | "support-area" | string;
  state: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  directionX: number;
  directionY: number;
  radius: number;
  power: number;
  durationMs: number;
  startedAt: number;
  expiresAt: number;
}

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
  ownedSkillIds: string[];
  equippedSkills: string[];
  skillUpgrades: SkillUpgradeState[];
  skillRuntime: PlayerSkillRuntimeState[];
  skillCatalog: SkillCatalogEntry[];
  currentLife: number;
  maxLife: number;
  isDead: boolean;
  respawnEndsAt?: number;
  spawnProtectionEndsAt?: number;
}

// Result of a player interaction (collect, deposit, etc.)
export interface InteractionResult {
  type: "interaction_result";
  action: string; // "collect_flower", "deposit_pollen", etc.
  success: boolean;
  amount: number; // pollen/honey involved
  reason: string; // error message or empty string
  reasonCode?: string;
  timestamp: number; // Unix milliseconds
}

export interface SkillEffectsMessage {
  type: "skill_effects";
  effects: SkillEffectState[];
}

export interface CombatEventMessage {
  type: "combat_event";
  eventId: string;
  eventKind: "damage" | "heal" | "death" | "respawn" | "blocked" | string;
  sourcePlayerId?: string;
  targetPlayerId: string;
  skillId?: string;
  amount: number;
  reason?: string;
  timestamp: number;
}

export interface FlowerInteractionState {
  flowerId: string;
  flowerX: number;
  flowerY: number;
  startedAt: number;
  phase: "moving" | "collecting";
}

export interface HiveInteractionState {
  hiveId: string;
  hiveX: number;
  hiveY: number;
  startedAt: number;
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
  ownedSkillIds: string[];
  equippedSkills: string[];
  skillUpgrades: SkillUpgradeState[];
  skillRuntime: PlayerSkillRuntimeState[];
  skillCatalog: SkillCatalogEntry[];
  currentLife: number;
  maxLife: number;
  isDead: boolean;
  respawnEndsAt?: number;
  spawnProtectionEndsAt?: number;
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

export type ServerMessage = SessionMessage | WorldStateMessage | PlayerStatusMessage | InteractionResult | ZoneStateMessage | SkillEffectsMessage | CombatEventMessage;

export interface GameSessionState {
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
  localPlayerId?: string;
  localUsername?: string;
  stageId?: string;
  stageName?: string;
  audioBgm?: string;
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  props: WorldPropState[];
  landmarks: WorldLandmarkState[];
  centerChunkX: number;
  centerChunkY: number;
  renderDistance: number;
  chunkSize: number;
  tick: number;
  playerProgress?: PlayerProgressState;
  lastInteraction?: InteractionResult;
  skillEffects: SkillEffectState[];
  flowerInteraction?: FlowerInteractionState;
  hiveInteraction?: HiveInteractionState;
  zones?: MapZone[];
  transitions?: MapTransition[];
  zoneState?: ZoneStateMessage;
  error?: string;
}

export interface GameSessionController extends GameSessionState {
  moveToTarget: (x: number, z: number) => void;
  targetFlower: (flower: WorldFlowerState) => void;
  targetHive: (hive: WorldHiveState) => void;
  clearTargets: () => void;
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
