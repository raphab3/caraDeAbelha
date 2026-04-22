# Tasks - Epic 01: Loop Base - Coleta e Mel

Status: in progress
Epic ID: EPIC-CDAM-01

## Task list

- [x] `TASK-CDAM-01-01` Modelar `PlayerProgress`, `FlowerNode` e `HiveNode` no backend com estado minimo para polen, capacidade, mel e raios de interacao.
- [ ] `TASK-CDAM-01-02` Promover flores e colmeias do mundo atual para entidades interativas do servidor, preservando o snapshot visual existente.
- [ ] `TASK-CDAM-01-03` Adicionar a acao `collect_flower` no protocolo e validar distancia, existencia da flor, capacidade da mochila e disponibilidade de polen.
- [ ] `TASK-CDAM-01-04` Implementar a regra de deposito automatico ao entrar na area da colmeia, com conversao autoritativa de polen em mel.
- [x] `TASK-CDAM-01-05` Adicionar mensagens `player_status` e `interaction_result` sem misturar todo o HUD dentro de `state`.
- [x] `TASK-CDAM-01-06` Estender `client/src/types/game.ts` e `client/src/hooks/useGameSession.ts` para armazenar progresso local e feedback efemero.
- [x] `TASK-CDAM-01-07` Separar handlers de terreno e de entidades em `InstancedWorldField` para que flor seja clicavel sem disparar movimento de chao por engano.
- [ ] `TASK-CDAM-01-08` Criar a HUD inicial do loop base com `ResourceRibbon`, `ObjectivePanel` e `InteractionFeed` sobre o viewport existente.
- [ ] `TASK-CDAM-01-09` Validar o fluxo completo com testes de backend, `pnpm build` no client e teste manual desktop/mobile.

## Definition of done

- o loop `coletar -> carregar -> converter -> ganhar mel` funciona ponta a ponta
- o HUD fica legivel sem transformar a tela em painel administrativo
- desktop e mobile conseguem interagir com flor sem ambiguidade de input