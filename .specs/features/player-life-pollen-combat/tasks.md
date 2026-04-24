# Tasks - Player Life, Pollen Energy and PvP Respawn

Status: draft
Feature: player-life-pollen-combat
Spec: `.specs/features/player-life-pollen-combat/spec.md`

## Premissas de execucao

- implementar em fatias pequenas sem quebrar coleta, deposito, compra, equip e runtime atual de skills;
- manter o servidor como autoridade unica para life, energia, dano, cura, morte e respawn;
- reutilizar `pollenCarried` e `pollenCapacity` como energia na V1, sem criar um pool paralelo;
- expandir o protocolo atual em vez de substituir `player_status`, `state` e `skill_effects`;
- priorizar primeiro legibilidade de estado e contrato antes de balanceamento fino;
- validar backend com `cd server && go test ./...` ou ao menos `cd server && go test ./internal/httpserver/...` quando a mudanca for local;
- validar client com `cd client && pnpm run typecheck` e, quando houver mudanca visual/protocolo mais ampla, `cd client && pnpm run build`.

## Task list

- [x] `TASK-PLPC-01` Modelar estado autoritativo de life, morte e protecao de respawn no servidor.
- [x] `TASK-PLPC-02` Expandir protocolo e tipos de cliente para life, energia e eventos de combate.
- [x] `TASK-PLPC-03` Adicionar HUD local de life, energia e estado de morto/respawn.
- [x] `TASK-PLPC-04` Exibir life minima e estado de morte para outros jogadores no mundo.
- [x] `TASK-PLPC-05` Cobrar energia em polen no cast e padronizar rejeicoes por energia insuficiente.
- [x] `TASK-PLPC-06` Implementar dano PvP de `Atirar Ferrão`.
- [x] `TASK-PLPC-07` Implementar efeito de controle PvP de `Slime de Mel`.
- [x] `TASK-PLPC-08` Implementar cura autoritativa de `Flor de Néctar`.
- [x] `TASK-PLPC-09` Implementar regeneracao natural de life e tag de combate.
- [x] `TASK-PLPC-10` Implementar morte, bloqueio de acoes e respawn automatico.
- [x] `TASK-PLPC-11` Garantir reconnect, limpeza de efeitos e consistencia de estados extremos.
- [x] `TASK-PLPC-12` Documentar tuning inicial, riscos e limites de performance do combate.

## Detalhamento

### `TASK-PLPC-01` Estado autoritativo de combate

Deliverable: modelo backend com campos de `currentLife`, `maxLife`, `isDead`, timers de regen/respawn e protecao curta apos nascer.

Requirement IDs:

- `REQ-PLPC-001`
- `REQ-PLPC-011`
- `REQ-PLPC-013`
- `REQ-PLPC-015`
- `REQ-PLPC-017`
- `REQ-PLPC-018`

Arquivos provaveis:

- `server/internal/gameplay/loopbase/models.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/ws_messages.go`

Done when:

- existe um estado canonico de combate por jogador no servidor;
- esse estado pode representar vivo, em combate, morto, respawnando e protegido;
- nenhuma decisao de vida/morte depende do cliente;
- testes cobrem inicializacao e serializacao minima desse estado.

### `TASK-PLPC-02` Protocolo e tipos de cliente

Deliverable: novos campos em `player_status`, `players[]`, `skillCatalog` e mensagem dedicada para `combat_event`.

Requirement IDs:

- `REQ-PLPC-001`
- `REQ-PLPC-003`
- `REQ-PLPC-006`
- `REQ-PLPC-019`
- `REQ-PLPC-020`
- `REQ-PLPC-023`

Arquivos provaveis:

- `server/internal/httpserver/ws_messages.go`
- `server/internal/httpserver/ws_messages_test.go`
- `client/src/types/game.ts`
- `client/src/hooks/useGameSession.ts`
- `client/src/game/skillCatalog.ts`

Done when:

- `player_status` transporta life e estado de respawn;
- `players[]` expõe life publica minima e `isDead`;
- catalogo/runtime de skill carrega `energyCostPollen`;
- cliente entende `combat_event` sem heuristica quebrada.

### `TASK-PLPC-03` HUD local de life e energia

Deliverable: HUD local com barra de life, medidor de `Energia (Pólen)`, feedback de morto/respawnando e falta de energia.

Requirement IDs:

- `REQ-PLPC-002`
- `REQ-PLPC-020`
- `REQ-PLPC-021`
- `REQ-PLPC-027`

Arquivos provaveis:

- `client/src/game/hud/`
- `client/src/game/hud/GameHUD.module.css`
- `client/src/game/hud/InteractionFeed.tsx`
- `client/src/hooks/useGameSession.ts`

Done when:

- o jogador ve life e energia locais o tempo todo;
- falta de energia tem feedback visual e textual distinto de cooldown;
- estado morto/respawnando fica legivel sem ambiguidade;
- o HUD nao passa a depender de estado inventado pelo cliente.

### `TASK-PLPC-04` Life remota no mundo

Deliverable: leitura compacta de life e estado de morte sobre jogadores visiveis.

Requirement IDs:

- `REQ-PLPC-006`
- `REQ-PLPC-020`
- `REQ-PLPC-021`

Arquivos provaveis:

- `client/src/components/GameViewport/`
- `client/src/game/hud/`
- `client/src/types/game.ts`

Done when:

- cada jogador remoto pode exibir life minima e estado morto;
- a leitura visual nao polui a cena excessivamente;
- a barra converge com o snapshot autoritativo.

### `TASK-PLPC-05` Energia em polen no cast

Deliverable: uso de skill desconta `pollenCarried` e falha corretamente quando faltar energia.

Requirement IDs:

- `REQ-PLPC-003`
- `REQ-PLPC-004`
- `REQ-PLPC-005`
- `REQ-PLPC-010`
- `REQ-PLPC-026`
- `REQ-PLPC-027`

Arquivos provaveis:

- `server/internal/httpserver/skills.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/ws_messages.go`
- `client/src/types/game.ts`
- `client/src/game/hud/InteractionFeed.tsx`

Done when:

- toda skill possui custo de energia em polen no contrato;
- cast aceito consome energia antes de publicar o efeito;
- cast rejeitado por falta de energia nao cria efeito duplicado;
- deposito em colmeia continua drenando o mesmo recurso usado como energia.

### `TASK-PLPC-06` Dano PvP de `Atirar Ferrão`

Deliverable: projectile acerta outro jogador valido e aplica dano autoritativo.

Requirement IDs:

- `REQ-PLPC-007`
- `REQ-PLPC-011`
- `REQ-PLPC-019`
- `REQ-PLPC-024`
- `REQ-PLPC-028`

Arquivos provaveis:

- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/skills.go`
- `client/src/components/GameViewport/`
- `client/src/hooks/useGameSession.ts`

Done when:

- o projectile encontra o primeiro alvo valido sem acertar o dono na V1;
- dano altera life do alvo de forma autoritativa;
- hit e feedback visual/local chegam por evento e snapshot;
- testes cobrem acerto, miss, self-hit bloqueado e morte nao letal.

### `TASK-PLPC-07` Controle PvP de `Slime de Mel`

Deliverable: area aplica ao menos lentidao autoritativa a outros jogadores afetados.

Requirement IDs:

- `REQ-PLPC-008`
- `REQ-PLPC-019`
- `REQ-PLPC-024`
- `REQ-PLPC-028`

Arquivos provaveis:

- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/ws_player.go`
- `client/src/components/GameViewport/`
- `client/src/hooks/useGameSession.ts`

Done when:

- entrar e sair da area altera o estado do alvo no servidor;
- o slow respeita duracao minima apos sair;
- a V1 pode sair sem dano por tick, mas o efeito de controle funciona de ponta a ponta;
- testes cobrem entrada, permanencia e expiracao.

### `TASK-PLPC-08` Cura de `Flor de Néctar`

Deliverable: area de suporte cura o dono por tick enquanto ele estiver dentro dela.

Requirement IDs:

- `REQ-PLPC-009`
- `REQ-PLPC-019`
- `REQ-PLPC-020`
- `REQ-PLPC-028`

Arquivos provaveis:

- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/ws_player.go`
- `client/src/components/GameViewport/`
- `client/src/hooks/useGameSession.ts`

Done when:

- a cura respeita `maxLife`;
- a area so cura o dono na V1;
- o jogador recebe feedback coerente de cura sem descolar do snapshot;
- testes cobrem cura ativa, life cheia e expiracao da area.

### `TASK-PLPC-09` Regeneracao natural e tag de combate

Deliverable: life volta automaticamente com atraso apos dano, pausando sempre que um novo hit chegar.

Requirement IDs:

- `REQ-PLPC-011`
- `REQ-PLPC-012`
- `REQ-PLPC-021`
- `REQ-PLPC-028`

Arquivos provaveis:

- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/gameplay/loopbase/models.go`
- `client/src/hooks/useGameSession.ts`

Done when:

- existe atraso configuravel antes de comecar a regen;
- novo dano reinicia essa janela corretamente;
- life sobe em ticks ate o maximo sem ultrapassar o teto;
- HUD consegue indicar recuperacao sem ruido excessivo.

### `TASK-PLPC-10` Morte, bloqueio e respawn automatico

Deliverable: ao zerar life, o jogador morre, para de agir e volta sozinho ao spawn com protecao curta.

Requirement IDs:

- `REQ-PLPC-013`
- `REQ-PLPC-014`
- `REQ-PLPC-015`
- `REQ-PLPC-016`
- `REQ-PLPC-017`
- `REQ-PLPC-018`
- `REQ-PLPC-022`

Arquivos provaveis:

- `server/internal/httpserver/ws_connection.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/world_runtime.go`
- `client/src/hooks/useGameSession.ts`
- `client/src/game/hud/`

Done when:

- jogador morto nao move, nao coleta, nao deposita e nao usa skill;
- o `respawn` manual deixa de ser necessario para voltar ao mundo;
- o respawn restaura life cheia, reposiciona no spawn e limpa o estado correto;
- protecao curta de spawn evita morte imediata em loop.

### `TASK-PLPC-11` Reconnect e estados extremos

Deliverable: sincronizacao consistente para desconexao, reconnect, morte durante efeitos ativos e limpeza de estados presos.

Requirement IDs:

- `REQ-PLPC-015`
- `REQ-PLPC-019`
- `REQ-PLPC-020`
- `REQ-PLPC-025`
- `REQ-PLPC-028`

Arquivos provaveis:

- `server/internal/httpserver/ws_connection.go`
- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/ws_messages.go`
- `client/src/hooks/useGameSession.ts`

Done when:

- reconnect converge para life, morte e respawn corretos;
- efeitos presos ao jogador morto sao limpos ou invalidados;
- cliente nao fica com HUD zumbi apos desconexao ou retomada;
- testes cobrem pelo menos reconnect em respawn e limpeza de runtime.

### `TASK-PLPC-12` Tuning, observabilidade e limites

Deliverable: notas finais de tuning de energia, dano, cura, regen, protecao de spawn e custo computacional.

Requirement IDs:

- `REQ-PLPC-023`
- `REQ-PLPC-028`

Arquivos provaveis:

- `.specs/features/player-life-pollen-combat/spec.md`
- `.specs/features/player-life-pollen-combat/tasks.md`
- `README.md` ou docs relacionados, se necessario

Done when:

- custos iniciais de energia e dano ficam registrados;
- riscos conhecidos de balanceamento e performance ficam explicitados;
- limites de simultaneidade ou simplificacoes da V1 ficam documentados.

## Ordem recomendada de execucao

1. `TASK-PLPC-01` Estado autoritativo de combate
2. `TASK-PLPC-02` Protocolo e tipos de cliente
3. `TASK-PLPC-03` HUD local de life e energia
4. `TASK-PLPC-05` Energia em polen no cast
5. `TASK-PLPC-06` Dano PvP de `Atirar Ferrão`
6. `TASK-PLPC-07` Controle PvP de `Slime de Mel`
7. `TASK-PLPC-08` Cura de `Flor de Néctar`
8. `TASK-PLPC-09` Regeneracao natural e tag de combate
9. `TASK-PLPC-10` Morte, bloqueio e respawn automatico
10. `TASK-PLPC-04` Life remota no mundo
11. `TASK-PLPC-11` Reconnect e estados extremos
12. `TASK-PLPC-12` Tuning, observabilidade e limites

## Dependencias importantes

- `TASK-PLPC-02` depende do modelo base de `TASK-PLPC-01`.
- `TASK-PLPC-03` e `TASK-PLPC-05` dependem do contrato expandido de `TASK-PLPC-02`.
- `TASK-PLPC-06`, `TASK-PLPC-07` e `TASK-PLPC-08` dependem de `TASK-PLPC-05` para custo de energia e de `TASK-PLPC-02` para eventos/tipos.
- `TASK-PLPC-09` depende de dano/cura basicos para validar a tag de combate.
- `TASK-PLPC-10` depende de `TASK-PLPC-01`, `TASK-PLPC-06` e `TASK-PLPC-09`.
- `TASK-PLPC-11` depende de o fluxo principal ja existir de ponta a ponta.

## Validacao minima por marco

### Marco A. Contrato e HUD

Inclui:

- `TASK-PLPC-01`
- `TASK-PLPC-02`
- `TASK-PLPC-03`
- `TASK-PLPC-05`

Validar com:

- `cd server && go test ./internal/httpserver/...`
- `cd client && pnpm run typecheck`

### Marco B. Combate funcional entre jogadores

Inclui:

- `TASK-PLPC-06`
- `TASK-PLPC-07`
- `TASK-PLPC-08`

Validar com:

- testes backend focados em projectile, area e cura;
- `cd client && pnpm run typecheck && pnpm run build`

### Marco C. Loop completo de morte e retorno

Inclui:

- `TASK-PLPC-09`
- `TASK-PLPC-10`
- `TASK-PLPC-04`
- `TASK-PLPC-11`

Validar com:

- testes backend para regen, morte, respawn e spawn protection;
- validacao manual de duas sessoes conectadas no mundo.