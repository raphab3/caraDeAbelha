# Epic 05: Quests e Ajudantes

Status: planned
Epic ID: EPIC-CDAM-05
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Adicionar estrutura de objetivos guiados e companheiros auxiliares, conectando economia, combate e progressao em uma camada de motivacao continua.

## Resultado esperado

O jogador passa a receber objetivos claros no mundo e ganha helpers que reforcam sua fantasia de enxame, em vez de jogar sozinho o tempo inteiro.

## Escopo

- NPCs de quest com objetivos basicos
- tipos iniciais de quest para coletar, derrotar e entregar
- recompensas em XP, mel ou item
- ovos e helpers com hatch simples
- helpers seguindo o jogador e ajudando em coleta ou combate inicial
- HUD de objetivo atual e estado dos ajudantes

## Fora de escopo

- sistema narrativo complexo
- quest chain longa e ramificada
- market de pets
- cooperacao de world boss

## Dependencias

- loop base consolidado
- combate PvE funcional para quests de derrota
- progressao minima para recompensas e escalonamento

## Criterios de aceite

- existe ao menos um NPC de quest ativo no mundo
- o jogo suporta ao menos tres tipos de objetivo: coletar, derrotar e entregar
- concluir uma quest gera recompensa autoritativa
- o jogador consegue obter ao menos um helper e perceber sua contribuicao no gameplay

## Riscos principais

- quests sem feedback no HUD viram conteudo invisivel
- helper sem limite claro pode competir com o proprio loop do jogador e trivializar o jogo cedo demais

## Observacoes

Este epic precisa conectar sistemas. Ele nao deve virar apenas uma lista de missao sem impacto real no mundo e nas recompensas.