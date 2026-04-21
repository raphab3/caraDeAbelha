import { useEffect, useState } from "react";

type InstallPromptOutcome = "accepted" | "dismissed" | "unavailable";

interface BeforeInstallPromptChoice {
  outcome: Exclude<InstallPromptOutcome, "unavailable">;
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

interface PwaInstallPromptState {
  canInstall: boolean;
  isInstalled: boolean;
  isIosManualInstall: boolean;
  promptInstall: () => Promise<InstallPromptOutcome>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

function isIosSafari(): boolean {
  const { maxTouchPoints, platform, userAgent } = window.navigator;
  const isTouchMac = platform === "MacIntel" && maxTouchPoints > 1;
  const isIosDevice = /iphone|ipad|ipod/i.test(userAgent) || isTouchMac;
  const isSafariBrowser = /safari/i.test(userAgent) && !/crios|fxios|edgios|opr\//i.test(userAgent);

  return isIosDevice && isSafariBrowser;
}

export function usePwaInstallPrompt(): PwaInstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    const syncInstallationState = () => {
      setIsInstalled(isStandaloneMode());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    syncInstallationState();

    if (typeof standaloneQuery.addEventListener === "function") {
      standaloneQuery.addEventListener("change", syncInstallationState);
    } else {
      standaloneQuery.addListener(syncInstallationState);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (typeof standaloneQuery.removeEventListener === "function") {
        standaloneQuery.removeEventListener("change", syncInstallationState);
      } else {
        standaloneQuery.removeListener(syncInstallationState);
      }

      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function promptInstall(): Promise<InstallPromptOutcome> {
    if (!deferredPrompt) {
      return "unavailable";
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }

    return choice.outcome;
  }

  return {
    canInstall: deferredPrompt !== null,
    isInstalled,
    isIosManualInstall: !isInstalled && isIosSafari(),
    promptInstall,
  };
}