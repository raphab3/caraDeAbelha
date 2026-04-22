import { useEffect, useRef } from "react";

interface UseStageBgmOptions {
  enabled: boolean;
  muted?: boolean;
  src?: string;
}

function normalizeAudioPath(src: string): string {
  return src.startsWith("/") ? src : `/${src}`;
}

export function useStageBgm({ enabled, muted = false, src }: UseStageBgmOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const normalizedSrc = src?.trim();
    if (!enabled || !normalizedSrc) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.34;
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    audio.muted = muted;
    const nextSrc = normalizeAudioPath(normalizedSrc);
    if (!audio.src.endsWith(nextSrc)) {
      audio.src = nextSrc;
      audio.currentTime = 0;
    }

    void audio.play().catch(() => {
      // Autoplay can be blocked until the user interacts with the page.
    });

    return () => {
      audio.pause();
    };
  }, [enabled, muted, src]);

  useEffect(() => {
    return () => {
      if (!audioRef.current) {
        return;
      }

      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
      audioRef.current = null;
    };
  }, []);
}
