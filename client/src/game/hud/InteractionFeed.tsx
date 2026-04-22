import { useEffect, useState } from "react";
import type { InteractionResult } from "../../types/game";

export interface InteractionFeedProps {
  lastInteraction: InteractionResult | undefined;
}

/**
 * InteractionFeed displays recent interaction results with auto-fade after 3 seconds.
 * Shows action name, success/failure status, and amount involved.
 * Uses green for success, red for failure.
 */
export const InteractionFeed = ({ lastInteraction }: InteractionFeedProps) => {
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!lastInteraction) {
      setVisible(false);
      setIsExiting(false);
      return;
    }

    setVisible(true);
    setIsExiting(false);

    const timeoutId = window.setTimeout(() => {
      setIsExiting(true);
      const fadeTimeoutId = window.setTimeout(() => {
        setVisible(false);
      }, 500); // Fade animation duration

      return () => {
        window.clearTimeout(fadeTimeoutId);
      };
    }, 3000); // Show for 3 seconds before fading

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastInteraction]);

  // Format action name for display
  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      collect_flower: "Colheu flor",
      deposit_pollen: "Depositou polen",
      collect_pollen: "Coletou polen",
      interact_hive: "Visitou colmeia",
      failed_collection: "Falha na coleta",
    };

    return labels[action] ?? action;
  };

  if (!visible || !lastInteraction) {
    return null;
  }

  const isSuccess = lastInteraction.success;
  const bgColor = isSuccess ? "bg-green-600" : "bg-red-600";
  const borderColor = isSuccess ? "border-green-700" : "border-red-700";
  const textColor = "text-white";
  const opacityClass = isExiting ? "opacity-0" : "opacity-100";

  return (
    <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 transition-opacity duration-500 ${opacityClass}`}>
      <div
        className={`
          ${bgColor} ${borderColor} ${textColor}
          px-6 py-4 rounded-lg border-2 shadow-2xl
          flex flex-col items-center gap-2
        `}
      >
        {/* Action Status */}
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="text-lg font-bold">{getActionLabel(lastInteraction.action)}</span>
        </div>

        {/* Amount and Status */}
        <div className="text-center">
          {lastInteraction.amount > 0 && (
            <p className="text-2xl font-bold">
              {isSuccess ? "+" : ""}
              {lastInteraction.amount}
            </p>
          )}
          {!isSuccess && lastInteraction.reason && (
            <p className="text-sm opacity-90 italic">{lastInteraction.reason}</p>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs opacity-75">
          {new Date(lastInteraction.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};
