import { type MutableRefObject, useEffect, useRef, useState } from "react";

interface FullscreenTargetState<T extends HTMLElement> {
  targetRef: MutableRefObject<T | null>;
  isFullscreen: boolean;
  isSupported: boolean;
  requestFullscreen: () => Promise<void>;
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
        document.fullscreenEnabled !== false &&
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

  async function requestFullscreen() {
    const target = targetRef.current;

    if (!target || typeof target.requestFullscreen !== "function") {
      return;
    }

    try {
      if (document.fullscreenElement === target) {
        return;
      }

      await target.requestFullscreen();
    } catch (error) {
      console.error("fullscreen request failed", error);
    }
  }

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

      await requestFullscreen();
    } catch (error) {
      console.error("fullscreen toggle failed", error);
    }
  }

  return {
    targetRef,
    isFullscreen,
    isSupported,
    requestFullscreen,
    toggleFullscreen,
  };
}