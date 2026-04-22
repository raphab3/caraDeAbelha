import { useEffect, useState } from "react";

import { API_URL } from "../game/env";
import type { AdminPlayersResponse, AdminPlayersState } from "../types/game";

const INITIAL_STATE: AdminPlayersState = {
  state: "loading",
  page: 1,
  pageSize: 8,
  total: 0,
  totalPages: 0,
  players: [],
};

export function useAdminPlayers(page: number, pageSize = 8, pollIntervalMs = 5000): AdminPlayersState {
  const [playersState, setPlayersState] = useState<AdminPlayersState>({
    ...INITIAL_STATE,
    page,
    pageSize,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/players?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) {
          throw new Error(`admin players returned ${response.status}`);
        }

        const data = (await response.json()) as AdminPlayersResponse;
        if (cancelled) {
          return;
        }

        setPlayersState({
          state: "online",
          service: data.service,
          updatedAt: data.timestamp,
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages,
          players: data.players,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "erro desconhecido";
        setPlayersState((current) => ({
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
  }, [page, pageSize, pollIntervalMs]);

  return playersState;
}