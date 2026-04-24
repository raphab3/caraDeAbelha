import { normalizePlayerProgressState } from "../../game/skillState";
import type { GameSessionController, PlayerProgressState, SkillCatalogEntry } from "../../types/game";
import styles from "./SkillLoadoutBar.module.css";

export interface SkillLoadoutBarProps {
  gameSessionController: GameSessionController | undefined;
  playerProgress: PlayerProgressState | undefined;
  selectedSkillId: string | undefined;
  onSelectSkill: (skillId: string | undefined) => void;
}

function getSkillMap(skillCatalog: SkillCatalogEntry[]): Map<string, SkillCatalogEntry> {
  return new Map(skillCatalog.map((entry) => [entry.id, entry]));
}

function getBadgeLabel(skillName: string): string {
  const letters = skillName
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return letters || "SK";
}

export const SkillLoadoutBar = ({
  gameSessionController,
  playerProgress,
  selectedSkillId,
  onSelectSkill,
}: SkillLoadoutBarProps) => {
  if (!playerProgress) {
    return null;
  }

  const normalizedProgress = normalizePlayerProgressState(playerProgress);
  const skillMap = getSkillMap(normalizedProgress.skillCatalog);
  const selectedSkill = selectedSkillId ? skillMap.get(selectedSkillId) : undefined;

  const handleSlotClick = (slotIndex: number, equippedSkillId: string) => {
    if (selectedSkillId) {
      gameSessionController?.sendAction({
        type: "equip_skill",
        skillId: selectedSkillId,
        slot: slotIndex,
      });
      onSelectSkill(undefined);
      return;
    }

    if (!equippedSkillId) {
      return;
    }

    onSelectSkill(equippedSkillId);
  };

  return (
    <div className={styles.root}>
      <div className={[styles.hint, selectedSkill ? styles.selected : ""].join(" ")}>
        {selectedSkill
          ? `Skill selecionada: ${selectedSkill.name}. Clique em um slot para equipar.`
          : "Slots de skills. Clique em uma skill comprada na loja ou em uma skill equipada para mover."}
      </div>

      <div className={styles.slots}>
        {normalizedProgress.equippedSkills.map((equippedSkillId, slotIndex) => {
          const skill = equippedSkillId ? skillMap.get(equippedSkillId) : undefined;
          const isArmedSlot = Boolean(selectedSkillId);

          return (
            <button
              key={`skill-slot-${slotIndex}`}
              className={[
                styles.slot,
                skill ? styles.slotFilled : "",
                isArmedSlot ? styles.slotArmed : "",
              ].join(" ")}
              onClick={() => {
                handleSlotClick(slotIndex, equippedSkillId);
              }}
              type="button"
            >
              <div className={styles.slotHeader}>
                <span className={styles.slotIndex}>{`Slot ${slotIndex + 1}`}</span>
                <span className={styles.badge}>{skill ? getBadgeLabel(skill.name) : slotIndex + 1}</span>
              </div>

              {skill ? (
                <>
                  <div>
                    <p className={styles.title}>{skill.name}</p>
                    <p className={styles.meta}>{skill.role}</p>
                  </div>
                  <p className={styles.action}>{selectedSkillId ? "Equipar aqui" : "Clique para mover"}</p>
                </>
              ) : (
                <>
                  <p className={styles.empty}>Nenhuma skill equipada</p>
                  <p className={styles.action}>{selectedSkillId ? "Equipar aqui" : "Slot vazio"}</p>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};