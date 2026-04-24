import { useEffect, useRef, useState } from "react";
import { normalizePlayerProgressState } from "../../game/skillState";
import type { GameSessionController, PlayerProgressState, SkillCatalogEntry } from "../../types/game";
import styles from "./SkillShopPanel.module.css";

export interface SkillShopPanelProps {
  gameSessionController: GameSessionController | undefined;
  isEditingSkills: boolean;
  isOpen: boolean;
  isRecordingHotkeyForSlot: number | undefined;
  onClose: () => void;
  onSelectSkill: (skillId: string | undefined) => void;
  onRequestHotkeyCapture: (slot: number | undefined) => void;
  onToggleEditingSkills: () => void;
  playerProgress: PlayerProgressState;
  selectedSkillId: string | undefined;
  slotHotkeys: string[];
}

interface FloatingPanelPosition {
  x: number;
  y: number;
}

const INITIAL_PANEL_POSITION: FloatingPanelPosition = {
  x: 16,
  y: 320,
};

let activeScrollLocks = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

function lockDocumentScroll(): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  activeScrollLocks += 1;
  if (activeScrollLocks === 1) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  return () => {
    activeScrollLocks = Math.max(0, activeScrollLocks - 1);
    if (activeScrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    }
  };
}

function clampPanelPosition(position: FloatingPanelPosition, panel: HTMLElement | null): FloatingPanelPosition {
  if (typeof window === "undefined") {
    return position;
  }

  const panelWidth = panel?.offsetWidth ?? 380;
  const panelHeight = panel?.offsetHeight ?? 520;
  const maxX = Math.max(12, window.innerWidth - panelWidth - 12);
  const maxY = Math.max(12, window.innerHeight - panelHeight - 12);

  return {
    x: Math.min(Math.max(12, position.x), maxX),
    y: Math.min(Math.max(96, position.y), maxY),
  };
}

function isSkillEquipped(equippedSkills: string[], skillId: string): boolean {
  return equippedSkills.includes(skillId);
}

function formatCooldownLabel(cooldownMs: number): string {
  return `${(cooldownMs / 1000).toFixed(cooldownMs >= 10000 ? 0 : 1)}s`;
}

function formatPowerLabel(power: number): string {
  return `${power.toFixed(2)}x`;
}

function formatDistanceLabel(distance: number): string {
  return `${distance.toFixed(distance >= 10 ? 0 : 1)}m`;
}

function resolveDistanceLabel(skillId: string): string {
  switch (skillId) {
    case "skill:impulso":
      return "Pulo";
    case "skill:atirar-ferrao":
      return "Alcance";
    default:
      return "Distancia";
  }
}

function resolvePowerLabel(skillId: string): string {
  switch (skillId) {
    case "skill:atirar-ferrao":
      return "Poder";
    case "skill:slime-de-mel":
      return "Intensidade";
    case "skill:flor-de-nectar":
      return "Forca";
    default:
      return "Power";
  }
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
  onClose,
  onSelectSkill,
  onRequestHotkeyCapture,
  onToggleEditingSkills,
  playerProgress,
  selectedSkillId,
  slotHotkeys,
}: SkillShopPanelProps) => {
  const normalizedProgress = normalizePlayerProgressState(playerProgress);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragOffsetRef = useRef<FloatingPanelPosition | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string>(normalizedProgress.skillCatalog[0]?.id ?? "");
  const [panelPosition, setPanelPosition] = useState<FloatingPanelPosition>(INITIAL_PANEL_POSITION);

  useEffect(() => {
    if (selectedSkillId && normalizedProgress.skillCatalog.some((entry) => entry.id === selectedSkillId)) {
      setActiveSkillId(selectedSkillId);
      return;
    }

    setActiveSkillId((current) => {
      if (normalizedProgress.skillCatalog.some((entry) => entry.id === current)) {
        return current;
      }
      return normalizedProgress.skillCatalog[0]?.id ?? "";
    });
  }, [normalizedProgress.skillCatalog, selectedSkillId]);

  useEffect(() => {
    const handleResize = () => {
      setPanelPosition((current) => clampPanelPosition(current, panelRef.current));
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    return lockDocumentScroll();
  }, [isOpen]);

  const activeSkill = normalizedProgress.skillCatalog.find((entry) => entry.id === activeSkillId) ?? normalizedProgress.skillCatalog[0];

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
      setActiveSkillId(entry.id);
      return;
    }

    onSelectSkill(entry.id);
    setActiveSkillId(entry.id);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    dragOffsetRef.current = {
      x: event.clientX - panelPosition.x,
      y: event.clientY - panelPosition.y,
    };

    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragOffsetRef.current) {
        return;
      }

      setPanelPosition(
        clampPanelPosition(
          {
            x: moveEvent.clientX - dragOffsetRef.current.x,
            y: moveEvent.clientY - dragOffsetRef.current.y,
          },
          panel,
        ),
      );
    };

    const handlePointerUp = () => {
      dragOffsetRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  if (!activeSkill) {
    return null;
  }

  const activeSkillOwned = normalizedProgress.ownedSkillIds.includes(activeSkill.id);
  const activeSkillEquipped = isSkillEquipped(normalizedProgress.equippedSkills, activeSkill.id);
  const activeSkillAction = resolveActionLabel(activeSkill, isEditingSkills, normalizedProgress, selectedSkillId);
  const activeSkillUpgrade = normalizedProgress.skillUpgrades.find((entry) => entry.skillId === activeSkill.id);
  const canUpgradeActiveSkill = Boolean(activeSkillOwned && activeSkillUpgrade?.canUpgrade && normalizedProgress.honey >= activeSkillUpgrade.nextUpgradeCost);
  const distanceLabel = resolveDistanceLabel(activeSkill.id);
  const powerLabel = resolvePowerLabel(activeSkill.id);
  const currentStats = [
    { key: "cooldown", label: "Cooldown", value: formatCooldownLabel(activeSkillUpgrade?.currentCooldownMs ?? activeSkill.baseCooldownMs), visible: true },
    { key: "distance", label: distanceLabel, value: formatDistanceLabel(activeSkillUpgrade?.currentDistance ?? activeSkill.baseDistance), visible: (activeSkillUpgrade?.currentDistance ?? activeSkill.baseDistance) > 0 },
    { key: "power", label: powerLabel, value: formatPowerLabel(activeSkillUpgrade?.currentPower ?? activeSkill.basePower), visible: (activeSkillUpgrade?.currentPower ?? activeSkill.basePower) > 0 },
  ].filter((entry) => entry.visible);
  const nextStats = [
    { key: "cooldown", label: "Cooldown", value: formatCooldownLabel(activeSkillUpgrade?.nextCooldownMs ?? activeSkill.baseCooldownMs), visible: Boolean(activeSkillUpgrade?.canUpgrade) },
    { key: "distance", label: distanceLabel, value: formatDistanceLabel(activeSkillUpgrade?.nextDistance ?? activeSkill.baseDistance), visible: Boolean(activeSkillUpgrade?.canUpgrade) && (activeSkillUpgrade?.nextDistance ?? activeSkill.baseDistance) > 0 },
    { key: "power", label: powerLabel, value: formatPowerLabel(activeSkillUpgrade?.nextPower ?? activeSkill.basePower), visible: Boolean(activeSkillUpgrade?.canUpgrade) && (activeSkillUpgrade?.nextPower ?? activeSkill.basePower) > 0 },
  ].filter((entry) => entry.visible);

  return (
    <section
      ref={panelRef}
      className={styles.root}
      aria-modal="true"
      aria-label="Loja de skills"
      role="dialog"
      style={{ left: `${panelPosition.x}px`, top: `${panelPosition.y}px` }}
    >
      <div className={styles.panelChrome}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Loja</p>
            <h2 className={styles.title}>Skills da colmeia</h2>
            <p className={styles.subtitle}>Clique em uma skill para ver detalhes e editar sem abrir uma lista longa.</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.honey}>
              <span className={styles.honeyLabel}>Mel</span>
              <span className={styles.honeyValue}>{normalizedProgress.honey}</span>
            </div>
            <button aria-label="Fechar loja" className={styles.closeButton} onClick={onClose} type="button">
              Fechar
            </button>
            <button aria-label="Mover loja" className={styles.dragHandle} onPointerDown={handlePointerDown} type="button">
              <span />
              <span />
            </button>
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
          <span className={styles.shortcutHint}>{isOpen ? "tecla L fecha a loja" : "tecla L abre a loja"}</span>
        </div>

        <div className={styles.layout}>
          <div className={styles.list}>
            {normalizedProgress.skillCatalog.map((entry) => {
              const owned = normalizedProgress.ownedSkillIds.includes(entry.id);
              const equipped = isSkillEquipped(normalizedProgress.equippedSkills, entry.id);

              return (
                <button
                  key={entry.id}
                  className={[
                    styles.skillRow,
                    activeSkill.id === entry.id ? styles.skillRowActive : "",
                    equipped ? styles.skillRowEquipped : "",
                  ].join(" ")}
                  onClick={() => {
                    setActiveSkillId(entry.id);
                  }}
                  type="button"
                >
                  <div className={styles.skillRowMain}>
                    <span className={styles.skillRowTitle}>{entry.name}</span>
                    <span className={styles.skillRowTag}>{entry.role}</span>
                  </div>
                  <div className={styles.skillRowMeta}>
                    <span className={styles.skillRowPrice}>{`${entry.costHoney} mel`}</span>
                    <span className={styles.skillRowState}>{owned ? (equipped ? "Equipada" : "Comprada") : "Bloqueada"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.nameRow}>
                  <h3 className={styles.name}>{activeSkill.name}</h3>
                  <span className={styles.tag}>{activeSkill.role}</span>
                </div>
                <p className={styles.summary}>{activeSkill.summary}</p>
              </div>
              <span className={styles.cost}>{`${activeSkill.costHoney} mel`}</span>
            </div>

            <p className={styles.meta}>
              {activeSkillOwned ? (activeSkillEquipped ? "Comprada e equipada" : "Comprada") : "Ainda nao comprada"}
            </p>

            {activeSkillOwned ? (
              <div className={styles.upgradeCard}>
                <div className={styles.upgradeHeader}>
                  <div>
                    <p className={styles.upgradeEyebrow}>Upgrade</p>
                    <p className={styles.upgradeLevel}>{`Nivel ${activeSkillUpgrade?.level ?? 0} de ${activeSkillUpgrade?.maxLevel ?? activeSkill.maxUpgradeLevel}`}</p>
                  </div>
                  <span className={styles.upgradePrice}>
                    {activeSkillUpgrade?.canUpgrade ? `${activeSkillUpgrade.nextUpgradeCost} mel` : "Maximo"}
                  </span>
                </div>

                <div className={styles.statGrid}>
                  {currentStats.map((stat) => (
                    <div key={stat.key} className={styles.statCard}>
                      <span className={styles.statLabel}>{stat.label}</span>
                      <strong className={styles.statValue}>{stat.value}</strong>
                    </div>
                  ))}
                </div>

                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Proximo nivel</span>
                  {activeSkillUpgrade?.canUpgrade ? (
                    <div className={styles.previewValues}>
                      {nextStats.map((stat) => (
                        <span key={stat.key} className={styles.previewValue}>
                          {`${stat.label} ${stat.value}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.previewLocked}>Sem novos upgrades</span>
                  )}
                </div>
              </div>
            ) : null}

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

            <div className={styles.actions}>
              <button
                className={[
                  styles.button,
                  activeSkillAction.disabled ? styles.buttonDisabled : "",
                  activeSkillAction.mode === "selected" ? styles.buttonSelected : "",
                ].join(" ")}
                disabled={activeSkillAction.disabled}
                onClick={() => {
                  handleAction(activeSkill);
                }}
                type="button"
              >
                {activeSkillAction.label}
              </button>

              {activeSkillOwned ? (
                <button
                  className={[
                    styles.button,
                    styles.upgradeButton,
                    !canUpgradeActiveSkill ? styles.buttonDisabled : "",
                  ].join(" ")}
                  disabled={!canUpgradeActiveSkill}
                  onClick={() => {
                    gameSessionController?.sendAction({
                      type: "upgrade_skill",
                      skillId: activeSkill.id,
                    });
                  }}
                  type="button"
                >
                  {activeSkillUpgrade?.canUpgrade ? "Melhorar" : "No maximo"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};