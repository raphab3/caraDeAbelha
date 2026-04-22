import { useEffect, useRef } from "react";
import type { GameSessionController, PlayerProgressState } from "../../types/game";

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
 * - zone_0: Prado de Flores (cost: 0, starting zone)
 * - zone_1: Bosque Central (cost: 50)
 * - zone_2: Colmeia Rainha (cost: 150)
 * - zone_3: Campos Selvagens (cost: 300)
 * - zone_4: Caverna Profunda (cost: 500)
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
    zone_0: { name: "Prado de Flores", cost: 0, prerequisites: [] },
    zone_1: { name: "Bosque Central", cost: 50, prerequisites: ["zone_0"] },
    zone_2: { name: "Colmeia Rainha", cost: 150, prerequisites: ["zone_1"] },
    zone_3: { name: "Campos Selvagens", cost: 300, prerequisites: ["zone_2"] },
    zone_4: { name: "Caverna Profunda", cost: 500, prerequisites: ["zone_3"] },
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
    <div className="fixed bottom-8 right-8 z-35 w-80 pointer-events-auto">
      <div className="bg-white/90 rounded-lg border-2 border-amber-500 shadow-2xl p-6 backdrop-blur">
        {/* Header */}
        <h2 className="text-lg font-bold text-amber-900 mb-4 uppercase tracking-wider">
          Desbloquear Zona
        </h2>

        {/* Zone Name */}
        <div className="mb-4 pb-3 border-b border-amber-200">
          <p className="text-sm font-semibold text-amber-700 mb-1">Zona</p>
          <p className="text-xl font-bold text-amber-900">{zoneInfo.name}</p>
        </div>

        {/* Cost Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Honey Cost */}
          <div className="bg-amber-50 rounded px-3 py-2 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700 mb-1">Custo</p>
            <p className="text-lg font-bold text-amber-900">{zoneInfo.cost}</p>
            <p className="text-xs text-amber-600">Mel</p>
          </div>

          {/* Player Honey */}
          <div className={`rounded px-3 py-2 border ${canAfford ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className="text-xs font-semibold text-amber-700 mb-1">Seu Mel</p>
            <p className={`text-lg font-bold ${canAfford ? "text-green-700" : "text-red-700"}`}>
              {playerHoney}
            </p>
            <p className="text-xs text-amber-600">Saldo</p>
          </div>
        </div>

        {/* Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={!canAfford}
          className={`w-full py-3 rounded-lg font-bold text-base uppercase tracking-wide transition-all duration-200 ${
            canAfford
              ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl active:scale-95 cursor-pointer"
              : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
          }`}
        >
          {canAfford ? "Desbloquear Zona" : "Mel Insuficiente"}
        </button>

        {/* Info Text */}
        <p className="text-xs text-amber-700 mt-3 text-center italic">
          {zoneInfo.cost === 0
            ? "Esta é uma zona inicial"
            : `Desbloqueie com mel para explorar novos territórios`}
        </p>
      </div>
    </div>
  );
};
