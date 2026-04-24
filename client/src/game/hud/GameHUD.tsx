import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { FlowerInteractionState, GameSessionController, InteractionResult, PlayerProgressState } from "../../types/game";
import { ResourceRibbon } from "./ResourceRibbon";
import { ObjectivePanel } from "./ObjectivePanel";
import { InteractionFeed } from "./InteractionFeed";
import { SkillLoadoutBar } from "./SkillLoadoutBar";
import { ZoneUnlockPanel } from "./ZoneUnlockPanel";
import styles from "./GameHUD.module.css";

const BLOCKED_SKILL_REASON_CODES = new Set(["blocked_path", "empty_slot", "invalid_skill", "invalid_slot"]);

export interface GameHUDProps {
  playerProgress: PlayerProgressState | undefined;
  lastInteraction: InteractionResult | undefined;
  flowerInteraction: FlowerInteractionState | undefined;
  gameSessionController: GameSessionController | undefined;
  lockedZoneId: string | undefined;
}

const SLOT_HOTKEYS_STORAGE_KEY = "cara-de-abelha.skill-slot-hotkeys";
const DEFAULT_SLOT_HOTKEYS = ["1", "2", "3", "4"];

function normalizeHotkey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d$/.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

function normalizeSlotHotkeys(slotHotkeys: string[] | null | undefined): string[] {
  return Array.from({ length: DEFAULT_SLOT_HOTKEYS.length }, (_, index) => normalizeHotkey(slotHotkeys?.[index]) ?? DEFAULT_SLOT_HOTKEYS[index]);
}

function readStoredSlotHotkeys(): string[] {
  try {
    const rawValue = window.localStorage.getItem(SLOT_HOTKEYS_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SLOT_HOTKEYS;
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? normalizeSlotHotkeys(parsed) : DEFAULT_SLOT_HOTKEYS;
  } catch {
    return DEFAULT_SLOT_HOTKEYS;
  }
}

export const GameHUD = ({
  playerProgress,
  lastInteraction,
  flowerInteraction,
  gameSessionController,
  lockedZoneId,
}: GameHUDProps) => {
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [recordingHotkeySlot, setRecordingHotkeySlot] = useState<number | undefined>(undefined);
  const [selectedSkillId, setSelectedSkillId] = useState<string | undefined>(undefined);
  const [slotHotkeys, setSlotHotkeys] = useState<string[]>(readStoredSlotHotkeys);
  const [lastRequestedSkillSlot, setLastRequestedSkillSlot] = useState<number | undefined>(undefined);
  const [blockedSkillFeedback, setBlockedSkillFeedback] = useState<{ slot: number; reasonCode: string } | undefined>(undefined);

  const handleCloseShop = () => {
    setIsShopOpen(false);
    setIsEditingSkills(false);
    setSelectedSkillId(undefined);
    setRecordingHotkeySlot(undefined);
  };

  const handleUseSkill = (slot: number) => {
    setLastRequestedSkillSlot(slot);
    setBlockedSkillFeedback(undefined);
    gameSessionController?.sendAction({
      type: "use_skill",
      slot,
    });
  };

  const handleToggleShop = () => {
    if (isShopOpen) {
      handleCloseShop();
      return;
    }

    setIsShopOpen(true);
  };

  const handleToggleEditingSkills = () => {
    setIsShopOpen(true);
    setIsEditingSkills((current) => {
      const next = !current;
      if (!next) {
        setSelectedSkillId(undefined);
        setRecordingHotkeySlot(undefined);
      }
      return next;
    });
  };

  useEffect(() => {
    window.localStorage.setItem(SLOT_HOTKEYS_STORAGE_KEY, JSON.stringify(slotHotkeys));
  }, [slotHotkeys]);

  useEffect(() => {
    if (lastInteraction?.action !== "use_skill" || lastInteraction.success || lastRequestedSkillSlot === undefined) {
      return;
    }

    if (!lastInteraction.reasonCode || !BLOCKED_SKILL_REASON_CODES.has(lastInteraction.reasonCode)) {
      return;
    }

    setBlockedSkillFeedback({ slot: lastRequestedSkillSlot, reasonCode: lastInteraction.reasonCode });
    const timeoutId = window.setTimeout(() => {
      setBlockedSkillFeedback(undefined);
    }, 520);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastInteraction, lastRequestedSkillSlot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const normalizedKey = normalizeHotkey(event.key);
      if (recordingHotkeySlot !== undefined) {
        if (event.key === "Escape") {
          event.preventDefault();
          setRecordingHotkeySlot(undefined);
          return;
        }

        if (!normalizedKey) {
          return;
        }

        event.preventDefault();
        setSlotHotkeys((current) => {
          const next = normalizeSlotHotkeys(current);
          const duplicateIndex = next.findIndex((value, index) => value === normalizedKey && index !== recordingHotkeySlot);
          if (duplicateIndex >= 0) {
            next[duplicateIndex] = DEFAULT_SLOT_HOTKEYS[duplicateIndex];
          }
          next[recordingHotkeySlot] = normalizedKey;
          return next;
        });
        setRecordingHotkeySlot(undefined);
        return;
      }

      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        handleToggleShop();
        return;
      }

      if (isShopOpen && isEditingSkills) {
        return;
      }

      const slotIndex = slotHotkeys.findIndex((value) => value === normalizedKey);
      if (slotIndex < 0 || !playerProgress?.equippedSkills?.[slotIndex]) {
        return;
      }

      event.preventDefault();
      handleUseSkill(slotIndex);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameSessionController, isEditingSkills, isShopOpen, playerProgress?.equippedSkills, recordingHotkeySlot, slotHotkeys]);

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className={styles.root} onContextMenu={handleContextMenu}>
      <div className={styles.topRibbon}>
        <ResourceRibbon
          playerProgress={playerProgress}
          lastInteraction={lastInteraction}
          flowerInteraction={flowerInteraction}
        />
      </div>

      <div className={styles.leftPanel}>
        <ObjectivePanel
          gameSessionController={gameSessionController}
          isEditingSkills={isEditingSkills}
          isRecordingHotkeyForSlot={recordingHotkeySlot}
          isShopOpen={isShopOpen}
          onCloseShop={handleCloseShop}
          onRequestHotkeyCapture={setRecordingHotkeySlot}
          onSelectSkill={setSelectedSkillId}
          onToggleEditingSkills={handleToggleEditingSkills}
          onToggleShop={handleToggleShop}
          playerProgress={playerProgress}
          selectedSkillId={selectedSkillId}
          slotHotkeys={slotHotkeys}
        />
      </div>

      <div className={styles.bottomLoadout}>
        <SkillLoadoutBar
          blockedSkillFeedback={blockedSkillFeedback}
          gameSessionController={gameSessionController}
          isEditingSkills={isEditingSkills && isShopOpen}
          onSelectSkill={setSelectedSkillId}
          onUseSkill={handleUseSkill}
          playerProgress={playerProgress}
          selectedSkillId={selectedSkillId}
          slotHotkeys={slotHotkeys}
        />
      </div>

      <ZoneUnlockPanel
        playerProgress={playerProgress}
        gameSessionController={gameSessionController}
        lockedZoneId={lockedZoneId}
      />

      <div className={styles.bottomFeed}>
        <InteractionFeed lastInteraction={lastInteraction} />
      </div>
    </div>
  );
};
