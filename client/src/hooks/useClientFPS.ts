import { useEffect, useState } from "react";

export function useClientFPS(sampleWindowMs = 600): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let frameCount = 0;
    let windowStart = performance.now();

    const measure = (timestamp: number) => {
      frameCount += 1;

      const elapsed = timestamp - windowStart;
      if (elapsed >= sampleWindowMs) {
        setFps(Math.max(0, Math.round((frameCount * 1000) / elapsed)));
        frameCount = 0;
        windowStart = timestamp;
      }

      frameId = window.requestAnimationFrame(measure);
    };

    frameId = window.requestAnimationFrame(measure);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [sampleWindowMs]);

  return fps;
}