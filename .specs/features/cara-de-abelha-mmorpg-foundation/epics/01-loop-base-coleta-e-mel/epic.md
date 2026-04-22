# Epic 01: Loop Base - Coleta e Mel

Status: planned
Epic ID: EPIC-CDAM-01
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Entregar o primeiro loop jogavel do produto: clicar em flores para coletar polen, encher a mochila, voltar a colmeia e converter polen em mel com feedback claro no HUD.

## Resultado esperado

Ao final deste epic, o jogador consegue executar o ciclo economico minimo do jogo sem depender de combate, quests ou sistemas de progressao avancada.

## Escopo

- flores e colmeias deixam de ser apenas props e passam a ser entidades interativas do mundo
- o servidor passa a controlar `pollenCarried`, `pollenCapacity` e `honey`
- o client ganha HUD de recursos, objetivo atual e feed de interacoes
- a coleta acontece por clique na flor dentro de alcance valido
- a conversao em mel acontece automaticamente ao entrar na area da colmeia

## Fora de escopo

- desbloqueio de zonas
- inimigos, combate e aggro
- equipamentos, skills e level up
- quests, ovos e helpers
- eventos globais e world boss

## Dependencias

- handshake e identificacao do jogador local ja disponiveis
- snapshot de mundo com flores e colmeias ja renderizadas no viewport
- tap targeting existente no client

## Criterios de aceite

- o clique em flor valida adiciona polen no servidor
- a mochila respeita um limite configurado
- entrar na colmeia com polen converte em mel e limpa a mochila
- o HUD mostra pelo menos `Polen`, `Mochila`, `Mel` e `Objetivo atual`
- o client recebe feedback curto para coleta bem-sucedida, mochila cheia e deposito realizado

## Riscos principais

- reaproveitar o mesmo handler do chao para flor pode gerar conflito entre mover e coletar
- usar `state` como unica fonte de HUD local pode inflar o payload desnecessariamente

## Observacoes

Este epic e a validacao central da matematica do jogo. Se ele nao ficar claro e satisfatorio, os epics seguintes vao escalar uma base fraca.