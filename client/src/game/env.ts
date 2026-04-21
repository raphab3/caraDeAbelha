const DEFAULT_API_URL = "http://localhost:8080";
const DEFAULT_WS_URL = "ws://localhost:8080/ws";

export const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;
export const WS_URL = import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;