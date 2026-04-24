import { useEffect, useState } from "react";
import type { InteractionResult } from "../../types/game";
import styles from "./InteractionFeed.module.css";

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
  const getActionLabel = (interaction: InteractionResult): string => {
    if (interaction.action === "collect_flower" && interaction.reason.startsWith("Coletando flor")) {
      return "Iniciou coleta";
    }

    if (interaction.action === "collect_flower" && interaction.reason.includes("XP ganho")) {
      return "Estudou flor";
    }

    const labels: Record<string, string> = {
      buy_skill: interaction.success ? "Skill comprada" : "Compra falhou",
      collect_flower: "Colheu flor",
      deposit_pollen: "Depositou polen",
      equip_skill: interaction.success ? "Skill equipada" : "Nao equipou",
      use_skill: interaction.success ? "Skill acionada" : "Skill indisponivel",
      collect_pollen: "Coletou polen",
      interact_hive: "Visitou colmeia",
      failed_collection: "Falha na coleta",
      level_up: "Subiu de nível",
    };

    return labels[interaction.action] ?? interaction.action;
  };

  if (!visible || !lastInteraction) {
    return null;
  }

  const isSuccess = lastInteraction.success;
  const isCollectingState = lastInteraction.action === "collect_flower" && lastInteraction.reason.startsWith("Coletando flor");
  const showReason = Boolean(lastInteraction.reason) && (
    !isSuccess ||
    lastInteraction.amount === 0 ||
    lastInteraction.reason.includes("XP ganho") ||
    lastInteraction.action === "buy_skill" ||
    lastInteraction.action === "equip_skill" ||
    lastInteraction.action === "use_skill"
  );
  const toneClass = isCollectingState ? styles.collecting : isSuccess ? styles.success : styles.error;
  const visibilityClass = isExiting ? styles.exiting : styles.visible;

  const amountLabel = (() => {
    if (lastInteraction.amount <= 0) {
      return null;
    }

    if (lastInteraction.action === "buy_skill") {
      return `-${lastInteraction.amount} mel`;
    }

    if (lastInteraction.action === "equip_skill") {
      return `Slot ${lastInteraction.amount}`;
    }

    if (lastInteraction.action === "use_skill") {
      return `Slot ${lastInteraction.amount}`;
    }

    return `${isSuccess ? "+" : ""}${lastInteraction.amount}`;
  })();

  return (
    <div className={[styles.feed, visibilityClass].join(" ")}>
      <div className={[styles.card, toneClass].join(" ")}>
        {/* Action Status */}
        <div className={styles.statusRow}>
          {isSuccess ? (
            <svg className={styles.icon} fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className={styles.icon} fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className={styles.title}>{isCollectingState ? "Coletando" : getActionLabel(lastInteraction)}</span>
        </div>

        {/* Amount and Status */}
        <div className="text-center">
          {amountLabel && (
            <p className={styles.amount}>
              {amountLabel}
            </p>
          )}
          {showReason && (
            <p className={styles.reason}>{lastInteraction.reason}</p>
          )}
        </div>

        {/* Timestamp */}
        <p className={styles.timestamp}>
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
