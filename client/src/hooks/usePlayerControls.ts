import { useEffect, useState } from "react";

interface PlayerMovementState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

const DEFAULT_MOVEMENT_STATE: PlayerMovementState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const KEY_TO_MOVEMENT: Record<string, keyof PlayerMovementState> = {
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "forward",
  KeyA: "left",
  KeyD: "right",
  KeyS: "backward",
  KeyW: "forward",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function usePlayerControls(): PlayerMovementState {
  const [movement, setMovement] = useState<PlayerMovementState>(DEFAULT_MOVEMENT_STATE);

  useEffect(() => {
    const updateMovement = (code: string, pressed: boolean) => {
      const movementKey = KEY_TO_MOVEMENT[code];
      if (!movementKey) {
        return;
      }

      setMovement((currentMovement) => {
        if (currentMovement[movementKey] === pressed) {
          return currentMovement;
        }

        return {
          ...currentMovement,
          [movementKey]: pressed,
        };
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (!(event.code in KEY_TO_MOVEMENT)) {
        return;
      }

      event.preventDefault();
      updateMovement(event.code, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (!(event.code in KEY_TO_MOVEMENT)) {
        return;
      }

      updateMovement(event.code, false);
    };

    const handleBlur = () => {
      setMovement(DEFAULT_MOVEMENT_STATE);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return movement;
}