import type { GameSessionController, PlayerProgressState, SkillCatalogEntry } from "../../types/game";
import styles from "./SkillShopPanel.module.css";

export interface SkillShopPanelProps {
  gameSessionController: GameSessionController | undefined;
  onSelectSkill: (skillId: string | undefined) => void;
  playerProgress: PlayerProgressState;
  selectedSkillId: string | undefined;
}

function findFirstEmptySlot(equippedSkills: string[]): number {
  return equippedSkills.findIndex((skillId) => skillId === "");
}

function isSkillEquipped(equippedSkills: string[], skillId: string): boolean {
  return equippedSkills.includes(skillId);
}

function resolveActionLabel(
  entry: SkillCatalogEntry,
  playerProgress: PlayerProgressState,
  selectedSkillId: string | undefined,
): { disabled: boolean; label: string; mode: "buy" | "select" | "selected" | "blocked" } {
  const owned = playerProgress.ownedSkillIds.includes(entry.id);
  const equipped = isSkillEquipped(playerProgress.equippedSkills, entry.id);

  if (!owned) {
    const canAfford = playerProgress.honey >= entry.costHoney;
    return {
      disabled: !canAfford,
      label: canAfford ? "Comprar" : "Sem mel",
      mode: canAfford ? "buy" : "blocked",
    };
  }

  if (selectedSkillId === entry.id) {
    return {
      disabled: false,
      label: "Selecionada",
      mode: "selected",
    };
  }

  return {
    disabled: false,
    label: equipped ? "Mover" : "Selecionar",
    mode: "select",
  };
}

export const SkillShopPanel = ({
  gameSessionController,
  onSelectSkill,
  playerProgress,
  selectedSkillId,
}: SkillShopPanelProps) => {
  const firstEmptySlot = findFirstEmptySlot(playerProgress.equippedSkills);

  const handleAction = (entry: SkillCatalogEntry) => {
    const owned = playerProgress.ownedSkillIds.includes(entry.id);
    if (!owned) {
      gameSessionController?.sendAction({
        type: "buy_skill",
        skillId: entry.id,
      });
      return;
    }

    if (selectedSkillId === entry.id) {
      onSelectSkill(undefined);
      return;
    }

    if (firstEmptySlot >= 0) {
      gameSessionController?.sendAction({
        type: "equip_skill",
        skillId: entry.id,
        slot: firstEmptySlot,
      });
      onSelectSkill(undefined);
      return;
    }

    onSelectSkill(entry.id);
  };

  return (
    <section className={styles.root} aria-label="Loja de skills">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Loja</p>
          <h2 className={styles.title}>Skills da colmeia</h2>
          <p className={styles.subtitle}>Compre com mel e equipe nos 4 slots ativos do rodapé.</p>
        </div>

        <div className={styles.honey}>
          <span className={styles.honeyLabel}>Mel</span>
          <span className={styles.honeyValue}>{playerProgress.honey}</span>
        </div>
      </div>

      <div className={styles.list}>
        {playerProgress.skillCatalog.map((entry) => {
          const owned = playerProgress.ownedSkillIds.includes(entry.id);
          const equipped = isSkillEquipped(playerProgress.equippedSkills, entry.id);
          const action = resolveActionLabel(entry, playerProgress, selectedSkillId);

          return (
            <article
              key={entry.id}
              className={[
                styles.card,
                selectedSkillId === entry.id ? styles.cardSelected : "",
                equipped ? styles.cardEquipped : "",
              ].join(" ")}
            >
              <div>
                <div className={styles.nameRow}>
                  <h3 className={styles.name}>{entry.name}</h3>
                  <span className={styles.tag}>{entry.role}</span>
                </div>
                <p className={styles.summary}>{entry.summary}</p>
                <p className={styles.meta}>
                  {owned ? (equipped ? "Comprada e equipada" : "Comprada") : "Ainda nao comprada"}
                </p>
              </div>

              <div className={styles.actions}>
                <span className={styles.cost}>{`${entry.costHoney} mel`}</span>
                <button
                  className={[
                    styles.button,
                    action.disabled ? styles.buttonDisabled : "",
                    action.mode === "selected" ? styles.buttonSelected : "",
                  ].join(" ")}
                  disabled={action.disabled}
                  onClick={() => {
                    handleAction(entry);
                  }}
                  type="button"
                >
                  {action.label}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};