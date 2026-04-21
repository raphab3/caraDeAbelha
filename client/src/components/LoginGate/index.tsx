import type { GameSessionState } from "../../types/game";

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
    <div className="login-gate" role="presentation">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <p className="login-eyebrow">Entrada do enxame</p>
        <h2>Escolha sua abelha</h2>
        <p className="login-copy">
          Ao entrar, o jardim abre em tela cheia e tenta recuperar o progresso salvo para esse username.
        </p>

        <label className="login-field" htmlFor="username">
          Username
        </label>

        <input
          id="username"
          className="login-input"
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

        {error ? <p className="login-error">{error}</p> : null}

        <button className="login-button" disabled={isBusy} type="submit">
          {getButtonLabel(connectionState)}
        </button>
      </form>
    </div>
  );
}