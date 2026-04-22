import type { PlayerProgressState } from "../../types/game";

export interface ObjectivePanelProps {
  playerProgress: PlayerProgressState | undefined;
}

/**
 * ObjectivePanel displays player objectives and zone progression:
 * - Current zone name and status
 * - List of unlocked zones
 * - Simple card-based layout for clarity
 */
export const ObjectivePanel = ({ playerProgress }: ObjectivePanelProps) => {
  // Zone name mapping (placeholder - would come from server in production)
  const zoneNames: Record<string, string> = {
    zone_0: "Prado de Flores",
    zone_1: "Bosque Central",
    zone_2: "Colmeia Rainha",
    zone_3: "Campos Selvagens",
    zone_4: "Caverna Profunda",
  };

  const getZoneName = (zoneId: string): string => {
    return zoneNames[zoneId] ?? `${zoneId}`;
  };

  if (!playerProgress) {
    return (
      <div className="fixed left-4 top-24 w-64 bg-white/80 rounded-lg border border-yellow-700/30 shadow-lg p-4">
        <div className="text-center text-yellow-900 font-medium">Carregando objetivos...</div>
      </div>
    );
  }

  return (
    <div className="fixed left-4 top-24 w-72 space-y-3">
      {/* Current Zone Card */}
      <div className="bg-white/85 rounded-lg border-2 border-amber-600 shadow-md p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">Zona Atual</h3>
        <div className="bg-amber-50/50 rounded px-3 py-2 border-l-4 border-amber-500">
          <p className="text-lg font-bold text-amber-900">{getZoneName(playerProgress.currentZoneId)}</p>
          <p className="text-xs text-amber-700 mt-1">ID: {playerProgress.currentZoneId}</p>
        </div>
      </div>

      {/* Unlocked Zones Card */}
      <div className="bg-white/85 rounded-lg border border-yellow-700/30 shadow-md p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-900 mb-3">Zonas Desbloqueadas</h3>

        {playerProgress.unlockedZoneIds.length === 0 ? (
          <div className="text-xs text-yellow-700 italic">Nenhuma zona desbloqueada ainda</div>
        ) : (
          <div className="space-y-2">
            {playerProgress.unlockedZoneIds.map((zoneId) => (
              <div key={zoneId} className="flex items-center gap-2 px-2 py-1 bg-yellow-50/40 rounded border-l-2 border-yellow-500">
                <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                <span className="text-sm font-medium text-yellow-900">{getZoneName(zoneId)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="bg-white/75 rounded-lg border border-yellow-700/20 shadow-sm p-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-yellow-800">Progresso Geral</span>
          <span className="text-sm font-bold text-amber-700">{playerProgress.skillPoints} SP</span>
        </div>
        <div className="mt-2 h-2 bg-yellow-900/20 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500"
            style={{ width: `${Math.min((playerProgress.level / 50) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-yellow-700 mt-2">Nível {playerProgress.level}</p>
      </div>
    </div>
  );
};
