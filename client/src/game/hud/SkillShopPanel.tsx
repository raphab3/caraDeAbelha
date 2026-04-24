import { normalizePlayerProgressState } from "../../game/skillState";
import type { GameSessionController, PlayerProgressState, SkillCatalogEntry } from "../../types/game";
import styles from "./SkillShopPanel.module.css";

export interface SkillShopPanelProps {
  gameSessionController: GameSessionController | undefined;
  isEditingSkills: boolean;
  isOpen: boolean;
  isRecordingHotkeyForSlot: number | undefined;
  onSelectSkill: (skillId: string | undefined) => void;
  onRequestHotkeyCapture: (slot: number | undefined) => void;
  onToggleEditingSkills: () => void;
  playerProgress: PlayerProgressState;
  selectedSkillId: string | undefined;
  slotHotkeys: string[];
}

function isSkillEquipped(equippedSkills: string[], skillId: string): boolean {
  return equippedSkills.includes(skillId);
}

function resolveActionLabel(
  entry: SkillCatalogEntry,
  isEditingSkills: boolean,
  playerProgress: PlayerProgressState,
  selectedSkillId: string | undefined,
): { disabled: boolean; label: string; mode: "buy" | "edit" | "select" | "selected" | "blocked" } {
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

  if (!isEditingSkills) {
    return {
      disabled: false,
      label: equipped ? "Editar slot" : "Abrir edicao",
      mode: "edit",
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
  isEditingSkills,
  isOpen,
  isRecordingHotkeyForSlot,
  onSelectSkill,
  onRequestHotkeyCapture,
  onToggleEditingSkills,
  playerProgress,
  selectedSkillId,
  slotHotkeys,
}: SkillShopPanelProps) => {
  const normalizedProgress = normalizePlayerProgressState(playerProgress);

  const handleAction = (entry: SkillCatalogEntry) => {
    const owned = normalizedProgress.ownedSkillIds.includes(entry.id);
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

    if (!isEditingSkills) {
      onToggleEditingSkills();
      onSelectSkill(entry.id);
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
          <p className={styles.subtitle}>
            {isEditingSkills
              ? "Modo edicao ativo. Escolha uma skill e ajuste atalhos numericos para os slots."
              : "Abra a edicao para trocar skills e configurar atalhos numericos."}
          </p>
        </div>

        <div className={styles.honey}>
          <span className={styles.honeyLabel}>Mel</span>
          <span className={styles.honeyValue}>{normalizedProgress.honey}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button
          className={[styles.button, isEditingSkills ? styles.buttonSelected : ""].join(" ")}
          onClick={onToggleEditingSkills}
          type="button"
        >
          {isEditingSkills ? "Fechar edicao" : "Editar skills"}
        </button>
        <span className={styles.shortcutHint}>{isOpen ? "Tecla L fecha a loja" : "Tecla L abre a loja"}</span>
      </div>

      {isEditingSkills ? (
        <div className={styles.bindings}>
          {normalizedProgress.equippedSkills.map((equippedSkillId, slotIndex) => (
            <div key={`binding-${slotIndex}`} className={styles.bindingRow}>
              <div>
                <p className={styles.bindingTitle}>{`Slot ${slotIndex + 1}`}</p>
                <p className={styles.bindingMeta}>{equippedSkillId ? equippedSkillId.replace("skill:", "") : "Sem skill equipada"}</p>
              </div>
              <button
                className={[
                  styles.bindingButton,
                  isRecordingHotkeyForSlot === slotIndex ? styles.bindingButtonRecording : "",
                ].join(" ")}
                onClick={() => {
                  onRequestHotkeyCapture(isRecordingHotkeyForSlot === slotIndex ? undefined : slotIndex);
                }}
                type="button"
              >
                {isRecordingHotkeyForSlot === slotIndex ? "Pressione um numero" : `Atalho ${slotHotkeys[slotIndex] ?? `${slotIndex + 1}`}`}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.list}>
        {normalizedProgress.skillCatalog.map((entry) => {
          const owned = normalizedProgress.ownedSkillIds.includes(entry.id);
          const equipped = isSkillEquipped(normalizedProgress.equippedSkills, entry.id);
          const action = resolveActionLabel(entry, isEditingSkills, normalizedProgress, selectedSkillId);

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