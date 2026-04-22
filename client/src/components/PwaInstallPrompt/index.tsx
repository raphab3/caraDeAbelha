import { useState } from "react";

import { usePwaInstallPrompt } from "../../hooks/usePwaInstallPrompt";

const DISMISS_STORAGE_KEY = "cara-de-abelha.installPromptDismissedUntil";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function readDismissedState(): boolean {
  const storedValue = window.localStorage.getItem(DISMISS_STORAGE_KEY);

  if (!storedValue) {
    return false;
  }

  const dismissedUntil = Number(storedValue);

  if (!Number.isFinite(dismissedUntil) || dismissedUntil <= Date.now()) {
    window.localStorage.removeItem(DISMISS_STORAGE_KEY);
    return false;
  }

  return true;
}

function persistDismissal(): void {
  window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
}

export function PwaInstallPrompt() {
  const [isDismissed, setIsDismissed] = useState(readDismissedState);
  const [isPrompting, setIsPrompting] = useState(false);
  const { canInstall, isInstalled, isIosManualInstall, promptInstall } = usePwaInstallPrompt();

  if (isDismissed || isInstalled) {
    return null;
  }

  const installHint = isIosManualInstall
    ? "No Safari do iPhone ou iPad, toque em Compartilhar e depois em Adicionar a Tela de Inicio."
    : "Se o botao de instalar nao aparecer sozinho, abra o menu do navegador ou teste no Chrome/Edge para instalar o app.";

  async function handleInstall() {
    setIsPrompting(true);
    const outcome = await promptInstall();
    setIsPrompting(false);

    if (outcome === "accepted") {
      setIsDismissed(true);
    }
  }

  return (
    <aside aria-label="Instalar app" className="player-install-banner">
      <div className="player-install-banner__copy">
        <p className="player-install-banner__eyebrow">Instale o app</p>
        <div className="player-install-banner__title">Leve o jardim para a tela inicial</div>
        <p className="player-install-banner__text">
          Abra mais rapido, entre com menos distracoes do navegador e volte para a aventura com um toque.
        </p>
        <p className="player-install-banner__hint">{installHint}</p>
      </div>

      <div className="player-install-banner__actions">
        {canInstall ? (
          <button
            className="player-install-banner__button"
            disabled={isPrompting}
            onClick={() => {
              void handleInstall();
            }}
            type="button"
          >
            {isPrompting ? "Abrindo instalador..." : "Instalar app"}
          </button>
        ) : null}

        <button
          className="player-install-banner__dismiss"
          onClick={() => {
            persistDismissal();
            setIsDismissed(true);
          }}
          type="button"
        >
          Agora nao
        </button>
      </div>
    </aside>
  );
}