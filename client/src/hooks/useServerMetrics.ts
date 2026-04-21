import { useEffect, useState } from "react";

import { API_URL } from "../game/env";
import type { ServerMetricsResponse, ServerMetricsState } from "../types/game";

const INITIAL_STATE: ServerMetricsState = {
  state: "loading",
  activePlayers: 0,
  tick: 0,
};

export function useServerMetrics(pollIntervalMs = 2000): ServerMetricsState {
  const [metrics, setMetrics] = useState<ServerMetricsState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/metrics`);
        if (!response.ok) {
          throw new Error(`metrics returned ${response.status}`);
        }

        const data = (await response.json()) as ServerMetricsResponse;
        if (cancelled) {
          return;
        }

        setMetrics({
          state: "online",
          service: data.service,
          updatedAt: data.timestamp,
          activePlayers: data.activePlayers,
          tick: data.tick,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "erro desconhecido";
        setMetrics((current) => ({
          ...current,
          state: "offline",
          error: message,
        }));
      }
    };

    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return metrics;
}