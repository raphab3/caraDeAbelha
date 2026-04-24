import styles from "./DisconnectModal.module.css";

interface DisconnectModalProps {
  error?: string;
  username?: string;
  onExit: () => void;
  onReconnect: () => void;
}

export function DisconnectModal({ error, username, onExit, onReconnect }: DisconnectModalProps) {
  return (
    <div className={styles.modal} role="presentation">
      <section
        aria-labelledby="disconnect-modal-title"
        aria-modal="true"
        className={styles.card}
        role="dialog"
      >
        <p className={styles.eyebrow}>Sessao interrompida</p>
        <h2 className={styles.title} id="disconnect-modal-title">Voce foi desconectado</h2>
        <p className={styles.copy}>
          {error ?? "A conexao com o jardim caiu ou ficou tempo demais sem resposta."}
        </p>

        {username ? <p className={styles.meta}>Reconectar como {username}</p> : null}

        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onExit} type="button">
            Sair
          </button>

          <button className={styles.primary} onClick={onReconnect} type="button">
            Reconectar
          </button>
        </div>
      </section>
    </div>
  );
}
