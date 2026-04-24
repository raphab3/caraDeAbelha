import { useCallback, useEffect, useState } from "react";

import { API_URL } from "../game/env";
import type { AdminStageImportResponse, AdminStagesResponse, AdminStagesState } from "../types/game";

const INITIAL_STATE: AdminStagesState = {
  state: "loading",
  stages: [],
};

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; fields?: string[] };
    return [payload.error, ...(payload.fields ?? [])].filter(Boolean).join(": ");
  } catch {
    return `HTTP ${response.status}`;
  }
}

export function useAdminStages(pollIntervalMs = 8000) {
  const [stagesState, setStagesState] = useState<AdminStagesState>(INITIAL_STATE);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stages`);
      if (!response.ok) {
        throw new Error(`admin stages returned ${response.status}`);
      }

      const data = (await response.json()) as AdminStagesResponse;
      setStagesState({
        state: "online",
        service: data.service,
        updatedAt: data.timestamp,
        stages: data.stages,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      setStagesState((current) => ({ ...current, state: "offline", error: message }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const guardedLoad = async () => {
      if (!cancelled) {
        await load();
      }
    };

    void guardedLoad();
    const intervalId = window.setInterval(() => {
      void guardedLoad();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [load, pollIntervalMs]);

  const importStage = useCallback(async (sourceJson: string): Promise<AdminStageImportResponse> => {
    const response = await fetch(`${API_URL}/admin/stages/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceJson, actor: "admin-ui" }),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = (await response.json()) as AdminStageImportResponse;
    await load();
    return payload;
  }, [load]);

  const postVersionAction = useCallback(async (versionId: string, action: "publish" | "activate"): Promise<AdminStageImportResponse> => {
    const response = await fetch(`${API_URL}/admin/stage-versions/${versionId}/${action}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = (await response.json()) as AdminStageImportResponse;
    await load();
    return payload;
  }, [load]);

  const postStageAction = useCallback(async (stageId: string, action: "archive" | "rollback") => {
    const response = await fetch(`${API_URL}/admin/stages/${stageId}/${action}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    await load();
  }, [load]);

  return {
    ...stagesState,
    reload: load,
    importStage,
    publishVersion: (versionId: string) => postVersionAction(versionId, "publish"),
    activateVersion: (versionId: string) => postVersionAction(versionId, "activate"),
    archiveStage: (stageId: string) => postStageAction(stageId, "archive"),
    rollbackStage: (stageId: string) => postStageAction(stageId, "rollback"),
  };
}
