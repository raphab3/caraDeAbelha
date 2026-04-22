# Tasks - Epic 07: Evolucao do Mundo e Stages Autorais

Status: in_progress
Epic ID: EPIC-CDAM-07

## Task list

- [x] `TASK-CDAM-07-01` Evoluir o formato de mapa para suportar `stageId`, `landmarks`, `edgeBehavior`, props ricos e composicao por prefab sem quebrar compatibilidade com o parser atual.
- [x] `TASK-CDAM-07-02` Definir um catalogo autoritativo de prefabs de mapa baseado nos kits disponiveis no repositorio, incluindo terreno, vegetacao, rochas, marcos visuais e elementos de borda.
- [x] `TASK-CDAM-07-03` Construir o primeiro stage autoral grande com relevo mais forte, landmarks claros e distribuicao de props superior ao mapa atual.
- [x] `TASK-CDAM-07-04` Implementar a regra de borda com `mundo util` e `vazio transitavel`, incluindo retorno comprimido e linguagem de mundo coerente.
- [x] `TASK-CDAM-07-05` Atualizar o runtime e o client para renderizar props ricos, landmarks e metadados do stage sem empurrar estado rapido para React state.
- [x] `TASK-CDAM-07-06` Integrar trilha ambiente inicial e preparar suporte a audio por stage ou por regiao principal.
- [ ] `TASK-CDAM-07-07` Validar que coleta, zonas, movimento, minimapa e multiplayer continuam funcionais no novo stage.
- [x] `TASK-CDAM-07-08` Documentar o pipeline de producao de novos stages para que o mundo evolua por composicao autoral, e nao por remendos no gerador inicial.

## Progress snapshot

- o parser de mapa agora aceita `stageId`, `displayName`, `audio`, `edgeBehavior`, `props`, `landmarks`, `zones` e `transitions`, com compatibilidade retroativa para o formato legado
- o catalogo `worldPrefabCatalog` ja cobre terreno, vegetacao, rochas, marcos visuais e elementos de borda usando os kits atuais do repositorio
- `server/maps/map.json` ja foi migrado para um stage autoral (`stage:starter-basin`) com props ricos, landmarks, transicao de borda e trilha ambiente inicial
- a borda com `outlands_return_corridor` ja esta ativa no servidor, incluindo clamp para `outlandsBounds` e retorno comprimido quando o jogador volta ao mundo util
- o snapshot autoritativo do servidor ja envia metadados do stage, `props`, `landmarks` e `audioBgm` para o client
- o client ja renderiza props ricos e landmarks com `StagePropRenderer`, toca a trilha do stage via `useStageBgm` e oferece controle de mute no dock de configuracoes

## Validacao executada ate agora

- testes focados do servidor para parser de mapa, retorno comprimido e snapshot autoritativo do stage passaram
- testes focados do servidor para coleta, deposito, `move_to` via websocket e reconexao por username tambem passaram sobre o stage atual
- `pnpm build` do client passou apos a integracao de props, landmarks, audio por stage e dock de configuracoes

### Cobertura automatica atual de `TASK-CDAM-07-07`

- parser e carga do stage: cobertos
- coleta e deposito: cobertos
- movimento com borda nova e retorno comprimido: cobertos
- snapshot do stage no websocket: coberto
- reconexao basica e persistencia de sessao por username: cobertas

### Lacunas restantes para fechar `TASK-CDAM-07-07`

- validacao manual do minimapa no stage novo
- checagem manual de multiplayer visual no stage novo com mais de um cliente ativo
- passada de UX jogavel para confirmar que a impressao do stage atende a Definition of Done, nao apenas a compilacao e aos testes focados

## O que ainda falta para fechar o epic

- executar a validacao final do stage em `TASK-CDAM-07-07`, cobrindo explicitamente coleta, zonas, movimento, minimapa e multiplayer sobre o mundo novo
- decidir se o stage inicial ja esta convincente o suficiente para Definition of Done ou se precisa de mais uma passada de densidade/verticalidade antes do encerramento do epic

## Definition of done

- o mundo principal passa a ter ao menos um stage autoral convincente
- a borda do mapa deixa de parecer limitacao tecnica
- a pipeline de mapas fica pronta para expansao visual e territorial antes da cidade