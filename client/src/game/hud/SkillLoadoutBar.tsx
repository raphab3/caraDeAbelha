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

function renderSkillIcon(skill: SkillCatalogEntry | undefined) {
  if (!skill) {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="12" />
        <path d="M24 8v6" />
        <path d="M24 34v6" />
        <path d="M8 24h6" />
        <path d="M34 24h6" />
      </svg>
    );
  }

  switch (skill.id) {
    case "skill:impulso":
      return (
        <svg aria-hidden="true" viewBox="0 0 48 48">
          <path d="M12 30l11-12 2 8 11-8-9 14-2-7-13 5z" />
        </svg>
      );
    case "skill:atirar-ferrao":
      return (
        <svg aria-hidden="true" viewBox="0 0 48 48">
          <path d="M12 24h18" />
          <path d="M24 16l12 8-12 8" />
          <path d="M12 18l4 6-4 6" />
        </svg>
      );
    case "skill:slime-de-mel":
      return (
        <svg aria-hidden="true" viewBox="0 0 48 48">
          <path d="M16 16h16v8a8 8 0 0 1-16 0z" />
          <path d="M20 30c0 3 2 6 4 6s4-3 4-6" />
        </svg>
      );
    case "skill:flor-de-nectar":
      return (
        <svg aria-hidden="true" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="4" />
          <path d="M24 10c4 0 6 4 6 7s-2 5-6 5-6-2-6-5 2-7 6-7z" />
          <path d="M38 24c0 4-4 6-7 6s-5-2-5-6 2-6 5-6 7 2 7 6z" />
          <path d="M24 38c-4 0-6-4-6-7s2-5 6-5 6 2 6 5-2 7-6 7z" />
          <path d="M10 24c0-4 4-6 7-6s5 2 5 6-2 6-5 6-7-2-7-6z" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 48 48">
          <path d="M24 10l10 6v12l-10 10-10-10V16z" />
        </svg>
      );
  }
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
      <div className={styles.slots}>
        {normalizedProgress.equippedSkills.map((equippedSkillId, slotIndex) => {
          const skill = equippedSkillId ? skillMap.get(equippedSkillId) : undefined;
          const isArmedSlot = Boolean(selectedSkillId) && isEditingSkills;
          const hotkey = slotHotkeys[slotIndex] ?? `${slotIndex + 1}`;

          return (
            <button
              key={`skill-slot-${slotIndex}`}
              className={[
                styles.slot,
                skill ? styles.slotFilled : "",
                isArmedSlot ? styles.slotArmed : "",
                !skill ? styles.slotEmpty : "",
              ].join(" ")}
              onClick={() => {
                handleSlotClick(slotIndex, equippedSkillId);
              }}
              type="button"
            >
              <div className={styles.slotHeader}>
                <span className={styles.slotIndex}>{`Slot ${slotIndex + 1}`}</span>
                <span className={styles.hotkeyBadge}>{hotkey}</span>
              </div>

              <div className={[styles.iconFrame, skill ? styles.iconFrameFilled : styles.iconFrameEmpty].join(" ")}>
                <span className={styles.iconGlyph}>{renderSkillIcon(skill)}</span>
              </div>

              {skill ? (
                <>
                  <div className={styles.content}>
                    <p className={styles.title}>{skill.name}</p>
                    <p className={styles.meta}>{skill.role}</p>
                  </div>
                  <div className={styles.footerRow}>
                    <span className={styles.badge}>{skill ? getBadgeLabel(skill.name) : `${slotIndex + 1}`}</span>
                    <p className={styles.action}>{isEditingSkills ? (selectedSkillId ? "Equipar" : "Mover") : "Usar"}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.empty}>Slot vazio</p>
                  <div className={styles.footerRow}>
                    <span className={styles.badge}>{`${slotIndex + 1}`}</span>
                    <p className={styles.action}>{isEditingSkills ? "Destino" : "Livre"}</p>
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