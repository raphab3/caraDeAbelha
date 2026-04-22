# Epic 04: Combate PvE e Bestiario

Status: planned
Epic ID: EPIC-CDAM-04
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Introduzir o primeiro ciclo de combate PvE com inimigos hostis, aggro, dano autoritativo, morte e recompensa basica.

## Resultado esperado

O mundo deixa de ser apenas economico e passa a oferecer risco, progressao de combate e um motivo para builds defensivas ou ofensivas.

## Escopo

- bestiario inicial com pelo menos uma Vespa hostil
- estados de inimigo como idle, chasing, attacking e dead
- sistema basico de aggro e perseguicao
- resolucao de dano autoritativa baseada em stats e equipamento
- recompensa minima por vitoria e respawn controlado
- feedback visual de combate no viewport e no HUD

## Fora de escopo

- world boss
- quests complexas encadeadas
- sinergias cooperativas avancadas
- helpers de suporte completo

## Dependencias

- progressao e stats basicos do Epic 03
- loop base e zonas prontas para contextualizar o encontro

## Criterios de aceite

- ao menos um inimigo detecta jogador em alcance e entra em estado de perseguicao
- o jogador consegue causar dano e receber dano de forma autoritativa
- a derrota do inimigo gera recompensa minima configurada
- o client exibe vida ou estado de combate suficiente para leitura da luta

## Riscos principais

- IA muito acoplada ao transporte WebSocket vai bloquear a evolucao do sistema
- feedback ruim de alvo, alcance e dano deixara o combate confuso mesmo com a regra correta

## Observacoes

Este epic deve comecar pequeno. Uma Vespa funcional vale mais do que um bestiario grande e inconsistente.