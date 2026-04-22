# Tasks - Epic 02: Zonas e Economia

Status: planned
Epic ID: EPIC-CDAM-02

## Task list

- [ ] `TASK-CDAM-02-01` Definir o modelo de `ZoneState` com custo, prerequisitos, limites espaciais e status de desbloqueio por jogador.
- [ ] `TASK-CDAM-02-02` Anotar o mapa com `zoneId` e pontos de transicao, preservando o pipeline atual de layout do mundo.
- [ ] `TASK-CDAM-02-03` Adicionar a acao de desbloqueio de zona usando mel como moeda autoritativa do servidor.
- [ ] `TASK-CDAM-02-04` Aplicar validacao server-side para negar acesso, coleta ou interacao em zonas nao liberadas.
- [ ] `TASK-CDAM-02-05` Expor estado minimo de zona para o client, incluindo custo, status atual e zonas liberadas.
- [ ] `TASK-CDAM-02-06` Implementar gates visuais coerentes com o tema, como fumaça hexagonal ou parede de favo de mel.
- [ ] `TASK-CDAM-02-07` Adicionar feedback contextual no HUD para custo de desbloqueio, falha por mel insuficiente e confirmacao de area liberada.
- [ ] `TASK-CDAM-02-08` Validar o fluxo com testes de compra, restricao de acesso e atualizacao visual da area desbloqueada.

## Definition of done

- mel vira moeda de expansao territorial de forma confiavel
- o servidor controla acesso a zonas
- o jogador percebe que avancou no mundo ao liberar uma nova area