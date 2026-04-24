# Task Checklist - CSS Componentization Roadmap

Status: ready
Feature: css-componentization-roadmap
Spec: `.specs/features/css-componentization-roadmap/spec.md`

## Premissas de execucao

- executar de forma incremental, sem big bang;
- priorizar componentes com maior dor de manutencao;
- nao mover estilos globais sem validar comportamento visual equivalente;
- manter `client/src/styles.css` funcional durante toda a migracao;
- usar `npm run typecheck` e `npm run build` como validacao minima por fatia;
- se `pnpm` estiver disponivel, os comandos equivalentes podem ser `pnpm run typecheck` e `pnpm run build`.

## Checklist

- [ ] `TASK-CSS-01` Criar base de tokens e contrato de CSS Modules.
- [ ] `TASK-CSS-02` Fazer piloto em componentes representativos.
- [ ] `TASK-CSS-03` Migrar HUD e overlays de gameplay.
- [ ] `TASK-CSS-04` Migrar Login, DisconnectModal, PWA prompt e SettingsDock.
- [ ] `TASK-CSS-05` Migrar MiniMap e overlays do GameViewport.
- [ ] `TASK-CSS-06` Migrar AdminLayout, AdminDashboard, AdminPlayersCard e AdminInfoPanel.
- [ ] `TASK-CSS-07` Migrar Map Builder Pro.
- [ ] `TASK-CSS-08` Migrar Map Generator e CSS local existente.
- [ ] `TASK-CSS-09` Reduzir `client/src/styles.css` para globais reais.
- [ ] `TASK-CSS-10` Criar guardrails de revisao e documentar exemplos.

## Detalhamento

### `TASK-CSS-01` Criar base de tokens e contrato de CSS Modules

Deliverable: estrutura minima de tokens globais e exemplo documentado de CSS Module local.

Requirement IDs:

- `REQ-CSS-001`
- `REQ-CSS-003`
- `REQ-CSS-004`
- `REQ-CSS-009`

Arquivos provaveis:

- `client/src/styles.css`
- `client/src/styles/tokens.css`
- `client/src/vite-env.d.ts`
- `README.md`

Done when:

- existe um local claro para tokens compartilhados;
- `styles.css` importa tokens sem quebrar Tailwind;
- TypeScript reconhece imports de `*.module.css` se necessario;
- ha um exemplo de naming e variantes para novos componentes;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-02` Fazer piloto em componentes representativos

Deliverable: migrar uma amostra pequena que prove os dois casos principais: JSX com Tailwind agregado e CSS global de componente.

Requirement IDs:

- `REQ-CSS-001`
- `REQ-CSS-002`
- `REQ-CSS-005`
- `REQ-CSS-006`
- `REQ-CSS-007`
- `REQ-CSS-008`

Arquivos candidatos:

- `client/src/game/hud/ResourceRibbon.tsx`
- `client/src/game/hud/ResourceRibbon.module.css`
- `client/src/components/LoginGate/index.tsx`
- `client/src/components/LoginGate/LoginGate.module.css`
- `client/src/components/MapBuilder/HeaderControls.tsx`
- `client/src/components/MapBuilder/HeaderControls.module.css`

Done when:

- pelo menos dois componentes estao usando CSS Modules locais;
- as strings longas de classes nos componentes piloto foram reduzidas;
- estados visuais continuam expressos por props/estado;
- foco visivel e areas clicaveis foram preservados;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-03` Migrar HUD e overlays de gameplay

Deliverable: HUD componentizado sem depender de estilos globais especificos de HUD.

Requirement IDs:

- `REQ-CSS-002`
- `REQ-CSS-005`
- `REQ-CSS-007`
- `REQ-CSS-008`
- `REQ-CSS-010`

Arquivos candidatos:

- `client/src/game/hud/GameHUD.tsx`
- `client/src/game/hud/ResourceRibbon.tsx`
- `client/src/game/hud/ObjectivePanel.tsx`
- `client/src/game/hud/InteractionFeed.tsx`
- `client/src/game/hud/ZoneUnlockPanel.tsx`
- `client/src/game/hud/PlayerStatusPanel.tsx`

Done when:

- HUD usa modules locais por componente;
- `z-index`, `pointer-events` e overlays continuam equivalentes;
- estados de coleta, XP, level up, unlock e erro continuam legiveis;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-04` Migrar Login, desconexao, PWA prompt e SettingsDock

Deliverable: camada de entrada/sessao componentizada.

Requirement IDs:

- `REQ-CSS-002`
- `REQ-CSS-005`
- `REQ-CSS-007`
- `REQ-CSS-008`
- `REQ-CSS-010`

Arquivos candidatos:

- `client/src/components/LoginGate/index.tsx`
- `client/src/components/DisconnectModal/index.tsx`
- `client/src/components/PwaInstallPrompt/index.tsx`
- `client/src/components/PlayerExperience/SettingsDock.tsx`
- `client/src/components/PlayerExperience/index.tsx`

Done when:

- estilos especificos saem do global para modules locais;
- fullscreen e estado desconectado continuam corretos;
- foco, disabled e mensagens de erro continuam acessiveis;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-05` Migrar MiniMap e overlays do GameViewport

Deliverable: overlays DOM do viewport com CSS local e sem regressao no canvas.

Requirement IDs:

- `REQ-CSS-002`
- `REQ-CSS-007`
- `REQ-CSS-008`
- `REQ-CSS-010`

Arquivos candidatos:

- `client/src/components/GameViewport/MiniMap.tsx`
- `client/src/components/GameViewport/MiniMap.module.css`
- `client/src/components/GameViewport/index.tsx`
- `client/src/components/GameViewport/FlowerRenderer.tsx`

Done when:

- MiniMap tem module local;
- regras globais `.mini-map*`, `.bee-nameplate*` e `.flower-focus*` foram reduzidas ou isoladas;
- canvas e controles continuam recebendo eventos corretamente;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-06` Migrar area Admin

Deliverable: admin componentizado sem strings Tailwind extensas em componentes de dashboard.

Requirement IDs:

- `REQ-CSS-001`
- `REQ-CSS-002`
- `REQ-CSS-005`
- `REQ-CSS-006`
- `REQ-CSS-007`
- `REQ-CSS-008`
- `REQ-CSS-011`

Arquivos candidatos:

- `client/src/components/AdminLayout/index.tsx`
- `client/src/components/AdminDashboard/index.tsx`
- `client/src/components/AdminPlayersCard/index.tsx`
- `client/src/components/AdminInfoPanel/index.tsx`
- `client/src/App.tsx`

Done when:

- layout admin, nav, cards e estados usam modules locais ou primitives compartilhados;
- rotas `/admin`, `/admin/mapas` e `/admin/builder` continuam renderizando;
- responsividade do shell admin foi preservada;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-07` Migrar Map Builder Pro

Deliverable: workbench do builder componentizada, preservando canvas dominante e shelf/inspector.

Requirement IDs:

- `REQ-CSS-001`
- `REQ-CSS-002`
- `REQ-CSS-005`
- `REQ-CSS-006`
- `REQ-CSS-007`
- `REQ-CSS-008`
- `REQ-CSS-011`

Arquivos candidatos:

- `client/src/components/MapBuilder/MapBuilderLayout.tsx`
- `client/src/components/MapBuilder/HeaderControls.tsx`
- `client/src/components/MapBuilder/AssetShelf.tsx`
- `client/src/components/MapBuilder/SelectionInspector.tsx`
- `client/src/components/MapBuilder/BuilderCanvas.tsx`

Done when:

- layout, header, shelf e inspector usam modules locais;
- estados de ferramenta, item selecionado, hover e fullscreen continuam visiveis;
- pintura, delete e exportacao continuam funcionais;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-08` Migrar Map Generator

Deliverable: substituir `styles.css` local do MapGenerator por CSS Module ou padrao local equivalente.

Requirement IDs:

- `REQ-CSS-001`
- `REQ-CSS-002`
- `REQ-CSS-004`
- `REQ-CSS-007`
- `REQ-CSS-011`

Arquivos candidatos:

- `client/src/components/MapGenerator/index.tsx`
- `client/src/components/MapGenerator/styles.css`
- `client/src/components/MapGenerator/MapGenerator.module.css`

Done when:

- import global local `./styles.css` foi removido ou substituido por module;
- sliders e canvas 2D mantem estilos/foco;
- `/admin/mapas` continua utilizavel;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-09` Reduzir `client/src/styles.css` para globais reais

Deliverable: arquivo global enxuto e sem estilos especificos de componente migrado.

Requirement IDs:

- `REQ-CSS-003`
- `REQ-CSS-004`
- `REQ-CSS-009`
- `REQ-CSS-010`

Arquivos candidatos:

- `client/src/styles.css`
- `client/src/styles/tokens.css`

Done when:

- `styles.css` contem apenas imports, reset/base, tokens, cursores e globais justificados;
- blocos migrados foram removidos sem deixar classes orfas;
- nao ha duplicacao obvia entre modules e global;
- `npm run typecheck` passa;
- `npm run build` passa.

### `TASK-CSS-10` Criar guardrails de revisao e exemplos

Deliverable: documentacao curta para novas features e revisoes futuras.

Requirement IDs:

- `REQ-CSS-001`
- `REQ-CSS-003`
- `REQ-CSS-004`
- `REQ-CSS-006`
- `REQ-CSS-012`

Arquivos candidatos:

- `README.md`
- `.github/copilot-instructions.md`
- `.github/instructions/tlc-spec-driven-agents.instructions.md`
- `.specs/features/css-componentization-roadmap/spec.md`
- `.specs/features/css-componentization-roadmap/task.md`

Done when:

- README e agents explicam a regra de CSS;
- ha exemplos de quando usar CSS Module versus Tailwind pontual;
- revisoes futuras tem criterio objetivo para bloquear novo CSS global de componente;
- `npm run typecheck` passa se algum arquivo frontend for tocado junto.

## Ordem recomendada

1. Executar `TASK-CSS-01`.
2. Executar `TASK-CSS-02` e revisar o padrao antes de escalar.
3. Migrar gameplay em `TASK-CSS-03`, `TASK-CSS-04` e `TASK-CSS-05`.
4. Migrar ferramentas internas em `TASK-CSS-06`, `TASK-CSS-07` e `TASK-CSS-08`.
5. Fechar limpeza global em `TASK-CSS-09`.
6. Consolidar guardrails em `TASK-CSS-10`.

## Riscos

- Migrar CSS global sem testar fullscreen pode quebrar overlays do jogo.
- Mover regras de `pointer-events` incorretamente pode bloquear clique no canvas ou HUD.
- Extrair Tailwind de forma mecanica pode piorar nomes se os modules nao seguirem responsabilidade do componente.
- Sem tokens, CSS Modules podem apenas espalhar hardcoded values em mais arquivos.
- Sem revisao visual manual, build verde nao prova equivalencia de UI.
