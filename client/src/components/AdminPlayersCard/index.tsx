import { useEffect, useState, type FormEvent } from "react";

import { API_URL } from "../../game/env";
import { useAdminPlayers } from "../../hooks/useAdminPlayers";
import type { AdminPlayerHoneyUpdateResponse, AdminPlayerSummaryDTO } from "../../types/game";

const LAST_SEEN_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

const PLAYERS_PAGE_SIZE = 8;

function formatLastSeenAt(lastSeenAt?: string): string {
  if (!lastSeenAt) {
    return "Sem atividade recente";
  }

  const parsedDate = new Date(lastSeenAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Sem atividade recente";
  }

  return LAST_SEEN_FORMATTER.format(parsedDate);
}

function resolveStatusClasses(online: boolean): string {
  return online ? "bg-emerald-400 shadow-[0_0_0_6px_rgba(74,222,128,0.12)]" : "bg-slate-500";
}

export function AdminPlayersCard() {
  const [page, setPage] = useState(1);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [saveErrorByPlayer, setSaveErrorByPlayer] = useState<Record<string, string>>({});
  const [localHoneyByPlayer, setLocalHoneyByPlayer] = useState<Record<string, number>>({});
  const adminPlayers = useAdminPlayers(page, PLAYERS_PAGE_SIZE);

  useEffect(() => {
    if (adminPlayers.page !== page) {
      setPage(adminPlayers.page);
    }
  }, [adminPlayers.page, page]);

  useEffect(() => {
    setLocalHoneyByPlayer((current) => {
      let changed = false;
      const next = { ...current };

      for (const player of adminPlayers.players) {
        if (next[player.id] === player.honey) {
          delete next[player.id];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [adminPlayers.players]);

  const hasPreviousPage = page > 1;
  const hasNextPage = adminPlayers.totalPages > 0 && page < adminPlayers.totalPages;

  const resolveDisplayedHoney = (player: AdminPlayerSummaryDTO): number => localHoneyByPlayer[player.id] ?? player.honey;

  const handleHoneySubmit = async (event: FormEvent<HTMLFormElement>, player: AdminPlayerSummaryDTO) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextHoney = Number(formData.get("honey"));
    if (!Number.isInteger(nextHoney) || nextHoney < 0) {
      setSaveErrorByPlayer((current) => ({
        ...current,
        [player.id]: "Informe um valor inteiro maior ou igual a zero.",
      }));
      return;
    }

    setSavingPlayerId(player.id);
    setSaveErrorByPlayer((current) => {
      if (!(player.id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[player.id];
      return next;
    });

    try {
      const response = await fetch(`${API_URL}/admin/players/${player.id}/honey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ honey: nextHoney }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `admin player honey returned ${response.status}`);
      }

      const data = (await response.json()) as AdminPlayerHoneyUpdateResponse;
      setLocalHoneyByPlayer((current) => ({
        ...current,
        [player.id]: data.player.honey,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      setSaveErrorByPlayer((current) => ({
        ...current,
        [player.id]: message,
      }));
    } finally {
      setSavingPlayerId((current) => (current === player.id ? null : current));
    }
  };

  return (
    <article className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 shadow-[0_20px_44px_rgba(2,6,23,0.26)] backdrop-blur md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Players</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Presenca e ultima atividade</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Ordenacao fixa: online primeiro. O saldo de mel pode ser ajustado na hora para quem estiver conectado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          <span className="inline-flex min-h-10 items-center rounded-full border border-emerald-300/25 bg-emerald-300/12 px-4 text-emerald-100">
            {adminPlayers.total} perfis
          </span>
          <span className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/5 px-4">
            Pagina {adminPlayers.page} de {Math.max(adminPlayers.totalPages, 1)}
          </span>
        </div>
      </div>

      {adminPlayers.state === "loading" ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-black/10 px-4 py-10 text-sm text-slate-300">
          Carregando presenca dos jogadores...
        </div>
      ) : null}

      {adminPlayers.state === "offline" ? (
        <div className="mt-5 rounded-[24px] border border-rose-300/15 bg-rose-300/8 px-4 py-4 text-sm text-rose-100">
          Nao foi possivel atualizar a lista agora. {adminPlayers.error ?? "Tente novamente em instantes."}
        </div>
      ) : null}

      {adminPlayers.state !== "loading" && adminPlayers.players.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-black/10 px-4 py-10 text-sm text-slate-300">
          Nenhum perfil apareceu no servidor ainda.
        </div>
      ) : null}

      {adminPlayers.players.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/10">
          <div className="hidden grid-cols-[minmax(0,1.1fr)_160px_minmax(220px,0.9fr)_220px] gap-3 border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 md:grid">
            <span>Username</span>
            <span>Status</span>
            <span>Mel realtime</span>
            <span>Ultima atividade</span>
          </div>

          <div className="divide-y divide-white/10">
            {adminPlayers.players.map((player) => {
              const displayedHoney = resolveDisplayedHoney(player);
              const isSaving = savingPlayerId === player.id;
              const saveError = saveErrorByPlayer[player.id];

              return (
              <div key={player.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.1fr)_160px_minmax(220px,0.9fr)_220px] md:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:hidden">Username</p>
                  <p className="text-sm font-semibold text-white">{player.username}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:hidden">Status</p>
                  <span className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${resolveStatusClasses(player.online)}`} />
                    {player.online ? "Online" : "Offline"}
                  </span>
                </div>

                <div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:hidden">Mel realtime</p>
                      <p className="text-sm font-semibold text-amber-100">{displayedHoney} mel</p>
                    </div>

                    <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void handleHoneySubmit(event, player)}>
                      <label className="sr-only" htmlFor={`player-honey-${player.id}`}>
                        Editar mel de {player.username}
                      </label>
                      <input
                        key={`${player.id}:${displayedHoney}`}
                        className="min-h-11 w-28 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-white outline-none transition-colors focus:border-amber-300/45"
                        defaultValue={displayedHoney}
                        disabled={isSaving}
                        id={`player-honey-${player.id}`}
                        inputMode="numeric"
                        min={0}
                        name="honey"
                        step={1}
                        type="number"
                      />
                      <button
                        className="inline-flex min-h-11 items-center rounded-full border border-amber-300/35 bg-amber-300/14 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isSaving}
                        type="submit"
                      >
                        {isSaving ? "Salvando..." : "Aplicar"}
                      </button>
                    </form>

                    <p className={`text-xs ${saveError ? "text-rose-200" : "text-slate-400"}`}>
                      {saveError ?? "Atualiza o saldo do jogador conectado sem esperar o proximo poll."}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:hidden">Ultima atividade</p>
                  <p className="text-sm text-slate-200">{formatLastSeenAt(player.lastSeenAt)}</p>
                </div>
              </div>
            );})}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Atualizado em {adminPlayers.updatedAt ? formatLastSeenAt(adminPlayers.updatedAt) : "--"}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasPreviousPage}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
            type="button"
          >
            Pagina anterior
          </button>

          <button
            className="inline-flex min-h-11 items-center rounded-full border border-amber-300/35 bg-amber-300/14 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasNextPage}
            onClick={() => {
              setPage((current) => current + 1);
            }}
            type="button"
          >
            Proxima pagina
          </button>
        </div>
      </div>
    </article>
  );
}