import { useEffect, useState } from "react";

import { API_URL } from "../game/env";
import type { HealthStatusResponse, HealthStatusState } from "../types/game";

const INITIAL_STATE: HealthStatusState = {
  state: "loading",
};

export function useBackendHealth(): HealthStatusState {
  const [health, setHealth] = useState<HealthStatusState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/healthz`);
        if (!response.ok) {
          throw new Error(`backend returned ${response.status}`);
        }

        const data = (await response.json()) as HealthStatusResponse;
        if (cancelled) {
          return;
        }

        setHealth({
          state: "online",
          service: data.service,
          updatedAt: data.timestamp,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "erro desconhecido";
        setHealth({
          state: "offline",
          error: message,
        });
      }
    };

    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return health;
}