# Tasks - Epic 07: Evolucao do Mundo e Stages Autorais

Status: planned
Epic ID: EPIC-CDAM-07

## Task list

- [ ] `TASK-CDAM-07-01` Evoluir o formato de mapa para suportar `stageId`, `landmarks`, `edgeBehavior`, props ricos e composicao por prefab sem quebrar compatibilidade com o parser atual.
- [ ] `TASK-CDAM-07-02` Definir um catalogo autoritativo de prefabs de mapa baseado nos kits disponiveis no repositorio, incluindo terreno, vegetacao, rochas, marcos visuais e elementos de borda.
- [ ] `TASK-CDAM-07-03` Construir o primeiro stage autoral grande com relevo mais forte, landmarks claros e distribuicao de props superior ao mapa atual.
- [ ] `TASK-CDAM-07-04` Implementar a regra de borda com `mundo util` e `vazio transitavel`, incluindo retorno comprimido e linguagem de mundo coerente.
- [ ] `TASK-CDAM-07-05` Atualizar o runtime e o client para renderizar props ricos, landmarks e metadados do stage sem empurrar estado rapido para React state.
- [ ] `TASK-CDAM-07-06` Integrar trilha ambiente inicial e preparar suporte a audio por stage ou por regiao principal.
- [ ] `TASK-CDAM-07-07` Validar que coleta, zonas, movimento, minimapa e multiplayer continuam funcionais no novo stage.
- [ ] `TASK-CDAM-07-08` Documentar o pipeline de producao de novos stages para que o mundo evolua por composicao autoral, e nao por remendos no gerador inicial.

## Definition of done

- o mundo principal passa a ter ao menos um stage autoral convincente
- a borda do mapa deixa de parecer limitacao tecnica
- a pipeline de mapas fica pronta para expansao visual e territorial antes da cidade