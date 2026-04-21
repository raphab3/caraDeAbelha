import { type MutableRefObject, useEffect, useRef, useState } from "react";

interface FullscreenTargetState<T extends HTMLElement> {
  targetRef: MutableRefObject<T | null>;
  isFullscreen: boolean;
  isSupported: boolean;
  toggleFullscreen: () => Promise<void>;
}

export function useFullscreenTarget<T extends HTMLElement>(): FullscreenTargetState<T> {
  const targetRef = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      const target = targetRef.current;

      setIsFullscreen(document.fullscreenElement === target);
      setIsSupported(
        typeof document.exitFullscreen === "function" &&
          typeof target?.requestFullscreen === "function",
      );
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  async function toggleFullscreen() {
    const target = targetRef.current;

    if (!target) {
      return;
    }

    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
        return;
      }

      await target.requestFullscreen();
    } catch (error) {
      console.error("fullscreen toggle failed", error);
    }
  }

  return {
    targetRef,
    isFullscreen,
    isSupported,
    toggleFullscreen,
  };
}