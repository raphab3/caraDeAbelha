# Tasks - Epic 02: Zonas e Economia

Status: planned
Epic ID: EPIC-CDAM-02

## Task list

- [ ] `TASK-CDAM-02-01` Definir `ZoneState` e persistencia de unlock por jogador para `zone:starter_meadow` e `zone:sunflower_ridge`, incluindo `zoneId`, `displayName`, `unlockHoneyCost`, `requiredZoneIds`, `bounds` e `isStarter`.
- [ ] `TASK-CDAM-02-02` Marcar entidades e transicao espacial da primeira fatia com `zoneId`, garantindo que flores, colmeias e gate entre `zone:starter_meadow` e `zone:sunflower_ridge` compartilhem a mesma referencia autoritativa.
- [ ] `TASK-CDAM-02-03` Implementar a acao `unlock_zone` no servidor, descontando `25 honey` de forma autoritativa e persistindo o unlock sem duplicidade.
- [ ] `TASK-CDAM-02-04` Aplicar bloqueio server-side de deslocamento e interacao para zonas nao liberadas, incluindo negar entrada, coleta e deposito em `zone:sunflower_ridge` antes do unlock.
- [ ] `TASK-CDAM-02-05` Expor para o client o catalogo minimo de zonas e o estado do jogador, reaproveitando `player_status` para `currentZoneId` e `unlockedZoneIds` e adicionando o contrato necessario para custo e prerequisitos.
- [ ] `TASK-CDAM-02-06` Implementar o gate visual da primeira transicao com leitura clara de bloqueio economico e estado liberado apos compra.
- [ ] `TASK-CDAM-02-07` Adicionar feedback contextual no HUD e no fluxo de interacao para nome da zona, custo, erro por mel insuficiente e confirmacao de desbloqueio.
- [ ] `TASK-CDAM-02-08` Validar a primeira fatia com testes de unlock bem-sucedido, falha por saldo insuficiente, persistencia apos reconexao e isolamento entre jogadores com estados de zona diferentes.

## Definition of done

- mel vira moeda de expansao territorial de forma confiavel
- o servidor controla acesso a zonas
- o jogador percebe que avancou no mundo ao liberar uma nova area