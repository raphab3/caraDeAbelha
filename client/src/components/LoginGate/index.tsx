import type { GameSessionState } from "../../types/game";

interface LoginGateProps {
  username: string;
  error?: string;
  connectionState: GameSessionState["connectionState"];
  onUsernameChange: (value: string) => void;
  onSubmit: () => void;
}

function getButtonLabel(connectionState: GameSessionState["connectionState"]): string {
  if (connectionState === "connecting") {
    return "Conectando...";
  }

  if (connectionState === "disconnected") {
    return "Tentar entrar de novo";
  }

  return "Entrar no jardim";
}

export function LoginGate({ username, error, connectionState, onUsernameChange, onSubmit }: LoginGateProps) {
  const isBusy = connectionState === "connecting";

  return (
    <div className="login-gate" role="presentation">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p className="login-eyebrow">Entrada local</p>
        <h2>Escolha seu username</h2>
        <p className="login-copy">
          O nome identifica sua abelha nesta sessao. Se voce entrar de novo com o mesmo username,
          o servidor recarrega o estado salvo desse jogador.
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