import { useEffect, useState } from "react";
import type { FlowerInteractionState, GameSessionController, InteractionResult, PlayerProgressState } from "../../types/game";
import { ResourceRibbon } from "./ResourceRibbon";
import { ObjectivePanel } from "./ObjectivePanel";
import { InteractionFeed } from "./InteractionFeed";
import { SkillLoadoutBar } from "./SkillLoadoutBar";
import { ZoneUnlockPanel } from "./ZoneUnlockPanel";
import styles from "./GameHUD.module.css";

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

  if (value === " ") {
    return "SPACE";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^[a-z0-9]$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^F\d{1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const aliases: Record<string, string> = {
    Space: "SPACE",
    Enter: "ENTER",
    Tab: "TAB",
  };

  return aliases[trimmed] ?? undefined;
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

/**
 * GameHUD is the top-level composition of all HUD layer components.
 * Layout:
 * - ResourceRibbon: top of screen (z-40, horizontal ribbon)
 * - ObjectivePanel: left side (z-30, card stack)
 * - ZoneUnlockPanel: bottom-right (z-35, unlock dialog)
 * - InteractionFeed: center-bottom (z-20, alerts)
 */
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

  const handleUseSkill = (slot: number) => {
    gameSessionController?.sendAction({
      type: "use_skill",
      slot,
    });
  };

  const handleToggleShop = () => {
    setIsShopOpen((current) => {
      const next = !current;
      if (!next) {
        setIsEditingSkills(false);
        setSelectedSkillId(undefined);
        setRecordingHotkeySlot(undefined);
      }
      return next;
    });
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

  return (
    <>
      {/* Top Ribbon with Resources */}
      <div className={styles.topRibbon}>
        <ResourceRibbon
          playerProgress={playerProgress}
          lastInteraction={lastInteraction}
          flowerInteraction={flowerInteraction}
        />
      </div>

      {/* Left Panel with Objectives */}
      <div className={styles.leftPanel}>
        <ObjectivePanel
          gameSessionController={gameSessionController}
          isEditingSkills={isEditingSkills}
          isRecordingHotkeyForSlot={recordingHotkeySlot}
          isShopOpen={isShopOpen}
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
          gameSessionController={gameSessionController}
          isEditingSkills={isEditingSkills && isShopOpen}
          onSelectSkill={setSelectedSkillId}
          onUseSkill={handleUseSkill}
          playerProgress={playerProgress}
          selectedSkillId={selectedSkillId}
          slotHotkeys={slotHotkeys}
        />
      </div>

      {/* Zone Unlock Panel (bottom-right) */}
      <ZoneUnlockPanel
        playerProgress={playerProgress}
        gameSessionController={gameSessionController}
        lockedZoneId={lockedZoneId}
      />

      {/* Center-Bottom Interaction Feed */}
      <div className={styles.bottomFeed}>
        <InteractionFeed lastInteraction={lastInteraction} />
      </div>
    </>
  );
};
