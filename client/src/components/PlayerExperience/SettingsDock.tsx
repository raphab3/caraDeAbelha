import { useEffect, useRef } from "react";

interface SettingsDockProps {
  isAudioMuted: boolean;
  isOpen: boolean;
  onExit: () => void;
  onRequestClose: () => void;
  onToggleAudio: () => void;
  onToggleOpen: () => void;
}

export function SettingsDock({
  isAudioMuted,
  isOpen,
  onExit,
  onRequestClose,
  onToggleAudio,
  onToggleOpen,
}: SettingsDockProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onRequestClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onRequestClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onRequestClose]);

  return (
    <div className="settings-dock" ref={rootRef}>
      {isOpen ? (
        <div className="settings-dock__panel" role="menu" aria-label="Configuracoes da experiencia">
          <button
            type="button"
            className="settings-dock__action"
            onClick={onToggleAudio}
            role="menuitem"
          >
            <span className="settings-dock__action-icon" aria-hidden="true">
              {isAudioMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <path d="m23 9-6 6" />
                  <path d="m17 9 6 6" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              )}
            </span>
            <span>{isAudioMuted ? "Ativar som" : "Mutar som"}</span>
          </button>

          <button
            type="button"
            className="settings-dock__action settings-dock__action--danger"
            onClick={onExit}
            role="menuitem"
          >
            <span className="settings-dock__action-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </span>
            <span>Sair</span>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="settings-dock__trigger"
        aria-label="Abrir configuracoes"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={onToggleOpen}
      >
        <span className="settings-dock__trigger-badge" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21v-7" />
            <path d="M4 10V3" />
            <path d="M12 21v-9" />
            <path d="M12 8V3" />
            <path d="M20 21v-5" />
            <path d="M20 12V3" />
            <path d="M2 14h4" />
            <path d="M10 8h4" />
            <path d="M18 12h4" />
          </svg>
        </span>
      </button>
    </div>
  );
}
