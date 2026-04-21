import type { ClientMessage, ServerMessage } from "../types/game";

interface WSClientHandlers {
  onMessage: (message: ServerMessage) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export class WSClient {
  private socket: WebSocket | null = null;

  constructor(private readonly url: string) {}

  connect(handlers: WSClientHandlers): void {
    if (this.socket) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      handlers.onOpen?.();
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        handlers.onMessage(message);
      } catch {
        handlers.onError?.(new Event("messageerror"));
      }
    });

    socket.addEventListener("close", (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      handlers.onClose?.(event);
    });

    socket.addEventListener("error", (event) => {
      handlers.onError?.(event);
    });
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}