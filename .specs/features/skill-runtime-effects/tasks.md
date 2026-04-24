# Tasks - Skill Runtime Effects

Status: draft
Feature: skill-runtime-effects
Spec: `.specs/features/skill-runtime-effects/spec.md`

## Premissas de execucao

- implementar de forma incremental sem quebrar compra/equip/loadout atuais;
- manter `use_skill` como entrada autoritativa e expandir o contrato em vez de substitui-lo;
- priorizar primeiro o ciclo completo `ready -> active/casting -> cooldown -> ready`;
- renderizacao de VFX deve ser leve e compativel com o runtime atual do mundo;
- validar backend com `cd server && go test ./internal/httpserver`;
- validar client com `cd client && pnpm run typecheck && pnpm run build`.

## Task list

- [ ] `TASK-SRE-01` Modelar runtime autoritativo de cooldown por slot e skill.
- [ ] `TASK-SRE-02` Expandir protocolo para estado privado de skill runtime e efeitos ativos do mundo.
- [ ] `TASK-SRE-03` Implementar feedback visual de cooldown e estados do slot no HUD.
- [ ] `TASK-SRE-04` Implementar `Impulso` com dash autoritativo e trail visual.
- [ ] `TASK-SRE-05` Implementar `Atirar Ferrão` com projectile runtime e renderer correspondente.
- [ ] `TASK-SRE-06` Implementar `Slime de Mel` com area temporaria e leitura visual de raio.
- [ ] `TASK-SRE-07` Implementar `Flor de Néctar` com area de suporte e broto visual.
- [ ] `TASK-SRE-08` Padronizar erros de `use_skill` e feedback de falha por motivo.
- [ ] `TASK-SRE-09` Garantir reconnect, expiracao e limpeza consistente de efeitos.
- [ ] `TASK-SRE-10` Documentar tuning inicial de cooldowns, payloads e limites de performance.

## Detalhamento

### `TASK-SRE-01` Runtime de cooldown

Deliverable: camada backend que armazena cooldown remanescente por slot ou skill equipada e valida `use_skill` contra esse runtime.

Requirement IDs:

- `REQ-SRE-001`
- `REQ-SRE-002`
- `REQ-SRE-021`
- `REQ-SRE-023`

Arquivos provaveis:

- `server/internal/httpserver/skills_cooldown.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/ws_messages.go`

Done when:

- cada slot consegue entrar e sair de cooldown por tempo autoritativo;
- spam de input durante cooldown nao cria efeito duplicado;
- testes cobrem aceite, rejeicao e cooldown remanescente.

### `TASK-SRE-02` Protocolo de runtime

Deliverable: tipos backend/client para `skillRuntime` privado e `skill_effects` no mundo.

Requirement IDs:

- `REQ-SRE-016`
- `REQ-SRE-017`
- `REQ-SRE-018`
- `REQ-SRE-020`

Arquivos provaveis:

- `server/internal/httpserver/ws_messages.go`
- `server/internal/httpserver/ws_messages_test.go`
- `client/src/types/game.ts`
- `client/src/hooks/useGameSession.ts`

Done when:

- `player_status` transporta cooldown/estado do slot;
- cliente reconcilia o estado novo sem heuristica quebrada;
- existe mensagem ou bloco dedicado para efeitos ativos do mundo.

### `TASK-SRE-03` HUD de cooldown

Deliverable: estados completos no slot com overlay de cooldown, estado ativo e feedback de falha.

Requirement IDs:

- `REQ-SRE-003`
- `REQ-SRE-004`
- `REQ-SRE-014`
- `REQ-SRE-015`

Arquivos provaveis:

- `client/src/game/hud/SkillLoadoutBar.tsx`
- `client/src/game/hud/SkillLoadoutBar.module.css`
- `client/src/game/hud/InteractionFeed.tsx`

Done when:

- o slot exibe pronto, ativo e cooldown de forma distinguivel;
- feedback local de clique nao fica preso sem confirmacao;
- UX funciona com clique e atalho numerico.

### `TASK-SRE-04` Impulso

Deliverable: dash curto autoritativo com rastro visual.

Requirement IDs:

- `REQ-SRE-006`
- `REQ-SRE-007`

Arquivos provaveis:

- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/skills_runtime.go`
- `client/src/components/GameViewport/`
- `client/src/game/`

Done when:

- uso aceito move a abelha de forma autoritativa;
- tiles bloqueados e bounds continuam respeitados;
- o client mostra trail/ghost curto coerente.

### `TASK-SRE-05` Atirar Ferrão

Deliverable: projectile runtime com travel e expiracao.

Requirement IDs:

- `REQ-SRE-008`
- `REQ-SRE-009`
- `REQ-SRE-018`

Done when:

- ferrão nasce com origem e direcao claras;
- o mundo renderiza travel visivel;
- expira e limpa corretamente;
- base fica pronta para colisao futura.

### `TASK-SRE-06` Slime de Mel

Deliverable: area temporaria no chao com leitura de raio.

Requirement IDs:

- `REQ-SRE-010`
- `REQ-SRE-011`
- `REQ-SRE-024`

Done when:

- poça aparece no mundo com duracao fixa;
- o cliente distingue claramente slime de outras areas;
- payload e renderizacao seguem leves.

### `TASK-SRE-07` Flor de Néctar

Deliverable: area de suporte com broto e aura.

Requirement IDs:

- `REQ-SRE-012`
- `REQ-SRE-013`
- `REQ-SRE-024`

Done when:

- broto nasce com pulso/expansao curta;
- leitura visual nao se confunde com slime;
- base de suporte futuro fica pronta.

### `TASK-SRE-08` Erros de uso

Deliverable: razoes de falha padronizadas e refletidas no HUD/feed.

Requirement IDs:

- `REQ-SRE-005`
- `REQ-SRE-015`
- `REQ-SRE-021`

Done when:

- cooldown, slot vazio e invalidez usam codigos/razoes distintas;
- o feed nao mostra a mesma mensagem para falhas diferentes;
- testes cobrem mapping de razoes.

### `TASK-SRE-09` Reconnect e limpeza

Deliverable: recuperacao de cooldown e limpeza de efeitos em reconnect, expiracao e troca de estado.

Requirement IDs:

- `REQ-SRE-018`
- `REQ-SRE-022`
- `REQ-SRE-023`

Done when:

- reconnect preserva cooldown remanescente;
- efeitos expirados saem do runtime e do client;
- estado nao fica zumbi apos desconexao.

### `TASK-SRE-10` Tuning e documentacao operacional

Deliverable: notas de tuning inicial de cooldown, limites de simultaneidade, payload e custo visual.

Requirement IDs:

- `REQ-SRE-024`

Done when:

- cooldowns iniciais ficam documentados;
- limites de efeitos simultaneos por jogador ficam definidos;
- riscos de performance e sinais de observabilidade ficam registrados.
