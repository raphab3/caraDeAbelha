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
  x: number;
  y: number;
}

export interface WorldStateMessage {
  type: "state";
  tick: number;
  players: WorldPlayerState[];
}

export type MoveDirection = "up" | "down" | "left" | "right";

export interface MoveAction {
  type: "move";
  dir: MoveDirection;
}

export type ClientMessage = MoveAction;
export type ServerMessage = WorldStateMessage;

export interface GameSessionState {
  connectionState: "connecting" | "connected" | "disconnected";
  players: WorldPlayerState[];
  tick: number;
  error?: string;
}