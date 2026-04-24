import { useEffect, useRef } from "react";
import type { GameSessionController, PlayerProgressState } from "../../types/game";
import styles from "./ZoneUnlockPanel.module.css";

export interface ZoneUnlockPanelProps {
  playerProgress: PlayerProgressState | undefined;
  gameSessionController: GameSessionController | undefined;
  lockedZoneId: string | undefined;
  onUnlockAttempt?: (zoneId: string) => void;
}

/**
 * ZoneUnlockPanel displays a modal for unlocking a locked zone.
 * Shows zone name, unlock cost, current honey balance, and unlock button.
 * Auto-hides when zone is successfully unlocked or no zone is targeted.
 *
 * Zone Definitions (from server registry):
 * - zone:starter_meadow: Starter Meadow (cost: 0, starting zone)
 * - zone:sunflower_ridge: Sunflower Ridge (cost: 25)
 */
export const ZoneUnlockPanel = ({
  playerProgress,
  gameSessionController,
  lockedZoneId,
  onUnlockAttempt,
}: ZoneUnlockPanelProps) => {
  const prevUnlockedZonesRef = useRef<string[]>([]);

  // Zone metadata (from server registry)
  const zoneMetadata: Record<
    string,
    { name: string; cost: number; prerequisites: string[] }
  > = {
    "zone:starter_meadow": { name: "Starter Meadow", cost: 0, prerequisites: [] },
    "zone:sunflower_ridge": {
      name: "Sunflower Ridge",
      cost: 25,
      prerequisites: ["zone:starter_meadow"],
    },
  };

  // Hide panel if zone is now unlocked
  useEffect(() => {
    if (!playerProgress || !lockedZoneId) {
      prevUnlockedZonesRef.current = playerProgress?.unlockedZoneIds ?? [];
      return;
    }

    // Check if zone was just unlocked
    const wasLocked = !prevUnlockedZonesRef.current.includes(lockedZoneId);
    const isNowUnlocked = playerProgress.unlockedZoneIds.includes(lockedZoneId);

    if (wasLocked && isNowUnlocked) {
      // Panel will auto-hide because lockedZoneId becomes undefined or isUnlocked becomes true
    }

    prevUnlockedZonesRef.current = playerProgress.unlockedZoneIds;
  }, [playerProgress, lockedZoneId]);

  // Don't render if no locked zone is targeted
  if (!lockedZoneId || !playerProgress) {
    return null;
  }

  // Don't render if zone is already unlocked
  if (playerProgress.unlockedZoneIds.includes(lockedZoneId)) {
    return null;
  }

  const zoneInfo = zoneMetadata[lockedZoneId];
  if (!zoneInfo) {
    return null; // Zone ID not found
  }

  const playerHoney = playerProgress.honey;
  const canAfford = playerHoney >= zoneInfo.cost;

  const handleUnlock = () => {
    if (!gameSessionController) {
      return;
    }

    onUnlockAttempt?.(lockedZoneId);

    // Send unlock_zone action to server
    gameSessionController.sendAction({
      type: "unlock_zone",
      zoneId: lockedZoneId,
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        {/* Header */}
        <h2 className={styles.title}>
          Desbloquear Zona
        </h2>

        {/* Zone Name */}
        <div className={styles.zone}>
          <p className={styles.label}>Zona</p>
          <p className={styles.zoneName}>{zoneInfo.name}</p>
        </div>

        {/* Cost Display */}
        <div className={styles.costGrid}>
          {/* Honey Cost */}
          <div className={styles.stat}>
            <p className={styles.label}>Custo</p>
            <p className={styles.value}>{zoneInfo.cost}</p>
            <p className={styles.meta}>Mel</p>
          </div>

          {/* Player Honey */}
          <div className={[styles.stat, canAfford ? styles.statAffordable : styles.statInsufficient].join(" ")}>
            <p className={styles.label}>Seu Mel</p>
            <p className={[styles.value, canAfford ? styles.valueAffordable : styles.valueInsufficient].join(" ")}>
              {playerHoney}
            </p>
            <p className={styles.meta}>Saldo</p>
          </div>
        </div>

        {/* Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={!canAfford}
          className={[styles.button, canAfford ? styles.buttonEnabled : styles.buttonDisabled].join(" ")}
        >
          {canAfford ? "Desbloquear Zona" : "Mel Insuficiente"}
        </button>

        {/* Info Text */}
        <p className={styles.hint}>
          {zoneInfo.cost === 0
            ? "Esta é uma zona inicial"
            : `Desbloqueie com mel para explorar novos territórios`}
        </p>
      </div>
    </div>
  );
};
