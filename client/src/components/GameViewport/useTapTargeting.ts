import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";

export interface TapTargetingConfig {
  dragThresholdMinPixels: number;
  dragThresholdScreenRatio: number;
  tapTimeThresholdMs: number;
}

export interface TapTargetingHandlers {
  onPointerCancel: (event: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (event: ThreeEvent<PointerEvent>) => void;
}

interface PendingTapState {
  hasExceededDragThreshold: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startedAtMs: number;
}

export const DEFAULT_TAP_TARGETING_CONFIG: TapTargetingConfig = {
  dragThresholdMinPixels: 12,
  dragThresholdScreenRatio: 0.02,
  tapTimeThresholdMs: 260,
};

function isTouchLikePointer(pointerEvent: PointerEvent): boolean {
  return pointerEvent.pointerType === "touch" || pointerEvent.pointerType === "pen";
}

function trySetPointerCapture(event: ThreeEvent<PointerEvent>): void {
  const target = event.target as { setPointerCapture?: (pointerId: number) => void };

  if (typeof target.setPointerCapture !== "function") {
    return;
  }

  try {
    target.setPointerCapture(event.nativeEvent.pointerId);
  } catch {
    // Pointer capture can fail if the browser already released the pointer.
  }
}

function tryReleasePointerCapture(event: ThreeEvent<PointerEvent>): void {
  const target = event.target as { releasePointerCapture?: (pointerId: number) => void };

  if (typeof target.releasePointerCapture !== "function") {
    return;
  }

  try {
    target.releasePointerCapture(event.nativeEvent.pointerId);
  } catch {
    // Ignore stale releases when the browser already cancelled the pointer.
  }
}

export function useTapTargeting({
  canvasWidth,
  config,
  onTap,
}: {
  canvasWidth: number;
  config?: Partial<TapTargetingConfig>;
  onTap: (event: ThreeEvent<PointerEvent>) => void;
}): { dragThresholdPx: number; pointerHandlers: TapTargetingHandlers; resetPendingTap: () => void } {
  const pendingTapRef = useRef<PendingTapState | null>(null);
  const resolvedConfig = useMemo(
    () => ({
      ...DEFAULT_TAP_TARGETING_CONFIG,
      ...config,
    }),
    [config],
  );
  // Scale the drag threshold with the canvas width so taps feel consistent across phones and tablets.
  const dragThresholdPx = Math.max(
    resolvedConfig.dragThresholdMinPixels,
    canvasWidth * resolvedConfig.dragThresholdScreenRatio,
  );
  const dragThresholdSquared = dragThresholdPx * dragThresholdPx;

  const resetPendingTap = useCallback(() => {
    pendingTapRef.current = null;
  }, []);

  const updatePendingTapMovement = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const pendingTap = pendingTapRef.current;
      if (!pendingTap || pendingTap.pointerId !== event.nativeEvent.pointerId) {
        return;
      }

      const deltaX = event.nativeEvent.clientX - pendingTap.startClientX;
      const deltaY = event.nativeEvent.clientY - pendingTap.startClientY;
      pendingTap.hasExceededDragThreshold ||= deltaX * deltaX + deltaY * deltaY > dragThresholdSquared;
    },
    [dragThresholdSquared],
  );

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const pointerEvent = event.nativeEvent;
      if (pointerEvent.button !== 0) {
        return;
      }

      if (!isTouchLikePointer(pointerEvent)) {
        event.stopPropagation();
        onTap(event);
        return;
      }

      if (!pointerEvent.isPrimary) {
        pendingTapRef.current = null;
        return;
      }

      if (pendingTapRef.current && pendingTapRef.current.pointerId !== pointerEvent.pointerId) {
        pendingTapRef.current = null;
      }

      trySetPointerCapture(event);
      pendingTapRef.current = {
        hasExceededDragThreshold: false,
        pointerId: pointerEvent.pointerId,
        startClientX: pointerEvent.clientX,
        startClientY: pointerEvent.clientY,
        startedAtMs: performance.now(),
      };
    },
    [onTap],
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      updatePendingTapMovement(event);
    },
    [updatePendingTapMovement],
  );

  const onPointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const pointerEvent = event.nativeEvent;
      if (!isTouchLikePointer(pointerEvent)) {
        return;
      }

      const pendingTap = pendingTapRef.current;
      if (!pendingTap || pendingTap.pointerId !== pointerEvent.pointerId) {
        tryReleasePointerCapture(event);
        return;
      }

      updatePendingTapMovement(event);
      const touchDurationMs = performance.now() - pendingTap.startedAtMs;
      const isValidTap = !pendingTap.hasExceededDragThreshold && touchDurationMs <= resolvedConfig.tapTimeThresholdMs;

      pendingTapRef.current = null;
      tryReleasePointerCapture(event);

      if (!isValidTap) {
        return;
      }

      event.stopPropagation();
      onTap(event);
    },
    [onTap, resolvedConfig.tapTimeThresholdMs, updatePendingTapMovement],
  );

  const onPointerCancel = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (pendingTapRef.current?.pointerId === event.nativeEvent.pointerId) {
      pendingTapRef.current = null;
    }

    tryReleasePointerCapture(event);
  }, []);

  const pointerHandlers = useMemo<TapTargetingHandlers>(
    () => ({
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    }),
    [onPointerCancel, onPointerDown, onPointerMove, onPointerUp],
  );

  return {
    dragThresholdPx,
    pointerHandlers,
    resetPendingTap,
  };
}