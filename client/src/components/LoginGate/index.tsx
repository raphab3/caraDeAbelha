import type { GameSessionState } from "../../types/game";
import styles from "./LoginGate.module.css";

interface LoginGateProps {
  username: string;
  error?: string;
  connectionState: GameSessionState["connectionState"];
  onUsernameChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}

function getButtonLabel(connectionState: GameSessionState["connectionState"]): string {
  if (connectionState === "connecting") {
    return "Abrindo o jardim...";
  }

  if (connectionState === "disconnected") {
    return "Tentar entrar de novo";
  }

  return "Comecar aventura";
}

export function LoginGate({ username, error, connectionState, onUsernameChange, onSubmit }: LoginGateProps) {
  const isBusy = connectionState === "connecting";

  return (
    <div className={styles.gate} role="presentation">
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <p className={styles.eyebrow}>Entrada do enxame</p>
        <h2 className={styles.title}>Escolha sua abelha</h2>
        <p className={styles.copy}>
          Ao entrar, o jardim abre em tela cheia e tenta recuperar o progresso salvo para esse username.
        </p>

        <label className={styles.field} htmlFor="username">
          Username
        </label>

        <input
          id="username"
          className={styles.input}
          autoComplete="username"
          autoFocus
          disabled={isBusy}
          maxLength={24}
          onChange={(event) => {
            onUsernameChange(event.target.value);
          }}
          placeholder="ex: beekeeper"
          type="text"
          value={username}
        />

        {error ? <p className={styles.error}>{error}</p> : null}

        <button className={styles.button} disabled={isBusy} type="submit">
          {getButtonLabel(connectionState)}
        </button>
      </form>
    </div>
  );
}
