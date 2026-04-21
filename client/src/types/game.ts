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
}

export interface WorldStateMessage {
  type: "state";
  tick: number;
  players: WorldPlayerState[];
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

export type ClientMessage = MoveAction;
export type ServerMessage = SessionMessage | WorldStateMessage;

export interface GameSessionState {
  connectionState: "idle" | "connecting" | "connected" | "disconnected";
  localPlayerId?: string;
  localUsername?: string;
  players: WorldPlayerState[];
  tick: number;
  error?: string;
}