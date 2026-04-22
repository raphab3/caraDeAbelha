# Epic 03: Progressao e Builds

Status: planned
Epic ID: EPIC-CDAM-03
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Introduzir a camada de progressao do personagem com level, XP, skill points, equipamentos e atributos derivados que suportem estilos de jogo distintos.

## Resultado esperado

O jogador deixa de evoluir apenas por repetir coleta e passa a construir uma identidade propria, com escolhas permanentes ou semi-permanentes de build.

## Escopo

- nivel, XP e skill points no servidor
- slots de equipamento para arma e armadura
- carga de atributos derivados de equipamento e skill tree
- dois caminhos iniciais de build: coletor e guerreiro
- interface inicial para ver loadout, stats e gasto de skill points

## Fora de escopo

- IA de inimigos e encontros PvE completos
- quests narrativas
- helpers e ovos
- eventos cooperativos globais

## Dependencias

- economia basica e loop de mel funcionando
- base de `player_status` ou equivalente para estado local do HUD

## Criterios de aceite

- o servidor calcula stats do jogador a partir de base, equipamento e skills
- o jogador consegue equipar ao menos uma arma e uma armadura validas
- o jogador consegue gastar skill points em pelo menos um caminho de coleta e um de combate
- o client mostra loadout, progresso e pontos disponiveis sem depender de heuristica local

## Riscos principais

- misturar regras de loadout com UI no client criaria inconsistencias
- skill points sem fonte clara de ganho podem virar sistema morto; o contrato precisa prever fontes mesmo antes do conteudo completo

## Observacoes

Este epic prepara a fundacao para combate, quest reward e cooperacao com papeis complementares.