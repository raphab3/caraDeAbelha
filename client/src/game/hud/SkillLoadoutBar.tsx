import { normalizePlayerProgressState } from "../../game/skillState";
import type { GameSessionController, PlayerProgressState, SkillCatalogEntry } from "../../types/game";
import styles from "./SkillLoadoutBar.module.css";

export interface SkillLoadoutBarProps {
  gameSessionController: GameSessionController | undefined;
  isEditingSkills: boolean;
  onUseSkill: (slot: number) => void;
  playerProgress: PlayerProgressState | undefined;
  selectedSkillId: string | undefined;
  slotHotkeys: string[];
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
  isEditingSkills,
  onUseSkill,
  playerProgress,
  selectedSkillId,
  slotHotkeys,
  onSelectSkill,
}: SkillLoadoutBarProps) => {
  if (!playerProgress) {
    return null;
  }

  const normalizedProgress = normalizePlayerProgressState(playerProgress);
  const skillMap = getSkillMap(normalizedProgress.skillCatalog);
  const selectedSkill = selectedSkillId ? skillMap.get(selectedSkillId) : undefined;

  const handleSlotClick = (slotIndex: number, equippedSkillId: string) => {
    if (isEditingSkills) {
      if (selectedSkillId) {
        gameSessionController?.sendAction({
          type: "equip_skill",
          skillId: selectedSkillId,
          slot: slotIndex,
        });
        onSelectSkill(undefined);
        return;
      }

      if (equippedSkillId) {
        onSelectSkill(equippedSkillId);
      }
      return;
    }

    if (!equippedSkillId) {
      return;
    }

    onUseSkill(slotIndex);
  };

  return (
    <div className={styles.root}>
      <div className={[styles.hint, selectedSkill ? styles.selected : ""].join(" ")}>
        {isEditingSkills
          ? selectedSkill
            ? `Editando loadout: ${selectedSkill.name} pronta para equipar.`
            : "Modo edicao ativo. Escolha uma skill na loja e clique em um slot para equipar."
          : "Clique no slot ou use o atalho configurado para acionar a skill equipada."}
      </div>

      <div className={styles.slots}>
        {normalizedProgress.equippedSkills.map((equippedSkillId, slotIndex) => {
          const skill = equippedSkillId ? skillMap.get(equippedSkillId) : undefined;
          const isArmedSlot = Boolean(selectedSkillId) && isEditingSkills;
          const hotkey = slotHotkeys[slotIndex] ?? "-";

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
                  <div className={styles.footerRow}>
                    <span className={styles.hotkey}>{hotkey}</span>
                    <p className={styles.action}>{isEditingSkills ? (selectedSkillId ? "Equipar aqui" : "Selecionar para mover") : "Acionar"}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.empty}>Nenhuma skill equipada</p>
                  <div className={styles.footerRow}>
                    <span className={styles.hotkey}>{hotkey}</span>
                    <p className={styles.action}>{isEditingSkills ? "Slot de destino" : "Slot vazio"}</p>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};