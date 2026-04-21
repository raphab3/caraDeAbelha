import { useState } from "react";

import { usePwaInstallPrompt } from "../../hooks/usePwaInstallPrompt";

export function PwaInstallPrompt() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const { canInstall, isInstalled, isIosManualInstall, promptInstall } = usePwaInstallPrompt();

  if (isDismissed || isInstalled || (!canInstall && !isIosManualInstall)) {
    return null;
  }

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

        {isIosManualInstall ? (
          <p className="player-install-banner__hint">
            No Safari do iPhone ou iPad, toque em Compartilhar e depois em Adicionar a Tela de Inicio.
          </p>
        ) : null}
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