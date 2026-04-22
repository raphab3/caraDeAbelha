# Epic 02: Zonas e Economia

Status: planned
Epic ID: EPIC-CDAM-02
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Transformar mel em moeda de progressao real, desbloqueando novas areas do mapa e criando uma camada de expansao territorial autoritativa por jogador.

## Resultado esperado

O jogador usa mel para liberar zonas novas e passa a ter uma sensacao clara de avancar no mapa, em vez de repetir coleta sempre no mesmo espaco.

## Escopo

- modelagem de zonas, custos e estado de desbloqueio por jogador
- contrato de compra ou liberacao de acesso a uma nova zona
- bloqueios visuais e mecanicos para areas nao liberadas
- HUD ou feedback contextual de zona bloqueada, custo e liberacao
- preparacao para novos biomas, flores e conteudo por zona

## Fora de escopo

- combate PvE
- quests e NPCs de objetivo
- equipamentos, builds e skill tree completos
- eventos globais e boss cooperativo

## Dependencias

- Epic 01 entregue com mel funcionando como moeda
- mapa com flores e colmeias ja consolidado no servidor e no client

## Criterios de aceite

- zonas possuem `zoneId`, custo e condicao de desbloqueio definidos no servidor
- um jogador sem desbloqueio nao acessa a zona nem seus beneficios
- um jogador com mel suficiente consegue liberar a zona e recebe feedback claro
- o client mostra barreiras ou gates coerentes com o tema do mundo

## Riscos principais

- fazer a restricao so no client deixaria o sistema vulneravel
- gates sem feedback visual forte podem parecer bugs de colisao ou mapa quebrado

## Observacoes

Este epic consolida a economia do loop base e prepara o terreno para quests, inimigos mais fortes e eventos por area.