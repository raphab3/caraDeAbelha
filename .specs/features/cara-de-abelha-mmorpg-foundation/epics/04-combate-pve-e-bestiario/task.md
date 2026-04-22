# Tasks - Epic 04: Combate PvE e Bestiario

Status: planned
Epic ID: EPIC-CDAM-04

## Task list

- [ ] `TASK-CDAM-04-01` Modelar `EnemyState` com HP, alcance, estado de IA, alvo atual e timers de combate.
- [ ] `TASK-CDAM-04-02` Implementar o primeiro inimigo hostil com spawn, patrulha minima e transicao para `chasing` ao detectar jogador.
- [ ] `TASK-CDAM-04-03` Adicionar acao de ataque ou interacao de combate do jogador, preservando o servidor como fonte da verdade.
- [ ] `TASK-CDAM-04-04` Calcular dano, mitigacao e derrota usando stats base, equipamento e skills disponiveis.
- [ ] `TASK-CDAM-04-05` Implementar recompensa minima, respawn e limpeza de estado ao fim do encontro.
- [ ] `TASK-CDAM-04-06` Expor mensagens e estado visual necessarios para HP, acerto, dano recebido e morte do inimigo.
- [ ] `TASK-CDAM-04-07` Criar indicadores visuais minimos de combate no viewport e no HUD sem poluir a cena.
- [ ] `TASK-CDAM-04-08` Validar aggro, dano, morte e sincronizacao multiusuario com testes automatizados e checagem manual.

## Definition of done

- existe um encontro PvE completo e minimamente legivel
- stats de build influenciam o combate
- o combate pode servir como base para quests e eventos futuros