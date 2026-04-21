interface DisconnectModalProps {
  error?: string;
  username?: string;
  onExit: () => void;
  onReconnect: () => void;
}

export function DisconnectModal({ error, username, onExit, onReconnect }: DisconnectModalProps) {
  return (
    <div className="disconnect-modal" role="presentation">
      <section
        aria-labelledby="disconnect-modal-title"
        aria-modal="true"
        className="disconnect-modal__card"
        role="dialog"
      >
        <p className="disconnect-modal__eyebrow">Sessao interrompida</p>
        <h2 id="disconnect-modal-title">Voce foi desconectado</h2>
        <p className="disconnect-modal__copy">
          {error ?? "A conexao com o jardim caiu ou ficou tempo demais sem resposta."}
        </p>

        {username ? <p className="disconnect-modal__meta">Reconectar como {username}</p> : null}

        <div className="disconnect-modal__actions">
          <button className="disconnect-modal__secondary" onClick={onExit} type="button">
            Sair
          </button>

          <button className="disconnect-modal__primary" onClick={onReconnect} type="button">
            Reconectar
          </button>
        </div>
      </section>
    </div>
  );
}