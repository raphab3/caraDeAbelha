# Epic 07: Evolucao do Mundo e Stages Autorais

Status: planned
Epic ID: EPIC-CDAM-07
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Substituir a dependencia do mapa gerado inicial por um pipeline de mundos autorais, modulares e visualmente ricos, capazes de sustentar a fantasia de MMORPG com stages maiores, relevo expressivo, landmarks fortes e uma regra de borda que elimine a sensacao de fim de mapa quebrado.

## Resultado esperado

O jogador passa a explorar um mundo grande e memoravel, com verticalidade real, cenarios mais ricos e transicoes mais organicas, sem depender de gates artificiais ou de um procedural que entrega pouco valor estético.

## Escopo

- pipeline de mapas autorais por stage, em vez de depender do gerador inicial como base principal
- evolucao do formato de mapa para suportar relevo, props ricos, landmarks, metadados de stage e regras de borda
- integracao progressiva dos kits 3D ja disponiveis no projeto
- definicao de uma regra autoritativa para borda do mundo com area de vazio transitavel e retorno comprimido
- ambientacao basica com trilha sonora e leitura mais forte de biomas e cenarios
- preparacao do mundo para zonas, cidade e futuros pontos de interesse sem redesenhar o pipeline depois

## Decisoes para a primeira implementacao

- o mapa gerado atual deixa de ser a fonte principal do mundo jogavel e passa a ser apenas fallback de desenvolvimento
- o mundo principal passa a ser composto por stages autorais com layout curado
- a primeira versao continua finita em conteudo util, mas elimina a parede dura de fim de mapa
- o jogador pode ultrapassar a ultima fronteira util e entrar em um vazio transitavel sem conteudo relevante
- o retorno desse vazio para o mundo util usa uma regra diegetica de volta comprimida, com menos tempo de caminhada do que a ida
- os kits disponiveis em `materials/Starter-Kit-3D-Platformer-main` e `client/public/kenney_platformer-kit/Models/GLB format` serao a base visual da primeira fatia

## Primeira fatia executavel

- um stage inicial autoral que substitui a percepcao de terreno de prototipo
	- relevo mais forte
	- rotas principais e secundarias claras
	- landmarks visuais reconheciveis
	- props mais ricos e agrupados
- uma borda externa com transicao para vazio transitavel
	- sem parede artificial abrupta
	- sem recompensa economica relevante fora do mundo util
- uma regra de retorno comprimido para quem se afasta demais
	- a ida ao vazio continua normal
	- a volta ao mundo util acontece por corredor, corrente de vento ou aceleracao assistida
- trilha ambiente unica para consolidar atmosfera
	- usar `client/public/assets/rpg-adventure.mp3`

Esta primeira fatia nao precisa resolver todos os biomas, nem um mundo aberto infinito real. Ela precisa provar que o jogo pode parecer um mundo de verdade com stages grandes e curados, sem quebrar o modelo autoritativo existente.

## Problema

O gerador de mapa foi suficiente para validar movimento, coleta e multiplayer basico, mas hoje ele limita a percepcao de escala, identidade e qualidade do mundo. Os bloqueios espaciais ficam artificiais, as montanhas nao parecem reais, a variedade cenografica e baixa e o mapa ainda transmite a sensacao de prototipo tecnico em vez de lugar persistente de MMORPG.

## Usuarios afetados

- jogador novo, que hoje ainda nao recebe uma primeira impressao de mundo memoravel
- jogador recorrente, que precisa sentir progressao espacial real, e nao so mudanca de numeros
- jogador que busca fantasia de exploracao, landmark e viagem longa dentro de um MMO

## Metas

- fazer o mundo parecer maior, mais alto, mais rico e mais vivo
- trocar limitacoes artificiais por geografia, atmosfera e borda intencional
- preparar o terreno para cidade, zonas, quests e PvE sem novo refactor de mapa depois
- consolidar um pipeline de mapa autoral reaproveitavel pelo time

## Restricoes

- o servidor continua autoritativo para limites jogaveis, zonas, transicoes e regras de retorno
- o client continua renderizando estado e enviando intencao, nao decidindo colisao ou acesso final sozinho
- a primeira versao nao busca mundo infinito real com conteudo procedural sem fim
- a nova pipeline precisa conviver com o formato atual tempo suficiente para migracao incremental
- assets e composicao precisam privilegiar reuso e estabilidade de runtime no viewport 3D

## Fora de escopo

- procedural infinito com economia e conteudo relevante
- geracao runtime completa de biomas complexos
- sistema de montaria, voo livre irrestrito ou transporte global completo
- cidade-colmeia compartilhada e comercio do hub
- rework total de combate, quests ou inventario

## Modelo esperado

- o mundo passa a ter `stages` autorais com identidade propria
- cada stage deve expor ao menos `stageId`, `displayName`, `tiles`, `props`, `zones`, `transitions`, `landmarks` e `edgeBehavior`
- o mapa deve suportar props mais ricos do que `flower`, `tree` e `hive`, com base em prefabs catalogados
- a borda do stage deve diferenciar `mundo util` de `vazio transitavel`
- o servidor deve continuar decidindo zona atual, clamp, transicoes e comportamento de retorno

## Fluxo principal

1. o jogador entra no stage principal e percebe um cenario mais alto, rico e orientado por landmarks
2. o jogador circula por rotas com leitura natural, sem depender de paredes de bloqueio obvias
3. o jogador alcanca a ultima fronteira util e entra no vazio transitavel
4. o jogo comunica que aquela area e marginal, com pouco ou nenhum valor de progressao
5. ao decidir voltar, o jogador usa ou recebe a regra de retorno comprimido para reentrar no mundo util em menos tempo de caminhada
6. o loop economico e de exploracao continua no mesmo mundo, agora com melhor fantasia espacial

## Contrato minimo esperado

- o formato de mapa precisa suportar metadados de stage e de borda, nao apenas tiles soltos
- a camada de props precisa apontar para prefabs autorais e nao apenas tipos literais simples
- o runtime precisa aceitar areas sem conteudo util mas ainda transitaveis
- o client precisa receber dados suficientes para renderizar landmarks, props ricos e pontos de orientacao
- o sistema de audio precisa suportar ao menos uma trilha ambiente por stage ou por regiao principal

## Regras de borda

- o mundo util e finito e curado
- o jogador pode sair do mundo util para um vazio transitavel
- o vazio nao oferece recompensa central de coleta ou progressao
- a volta ao mundo util deve ser mais curta, assistida ou comprimida em comparacao com a ida profunda ao vazio
- essa compressao precisa ser explicavel por linguagem de mundo, como corrente de vento, corredor de retorno ou impulso natural da colmeia

## Feedback de UX esperado

- o jogador percebe verticalidade e horizonte real antes de perceber UI explicativa
- landmarks orientam mais do que setas ou textos longos
- a borda do mundo parece uma escolha de world design, nao erro de mapa ou colisao
- o audio reforca presenca e atmosfera desde a entrada no stage

## Dependencias

- pipeline atual de mundo em `world_map.go` e `GameViewport` ainda operante para migracao incremental
- reaproveitamento dos kits visuais ja presentes no repositorio
- manutencao do estado autoritativo de zonas e interacoes no servidor

## Criterios de aceite

- o mundo principal deixa de depender do gerador inicial como fonte principal do stage jogavel
- ao menos um stage autoral grande e navegavel entra no jogo com relevo mais expressivo e props mais ricos
- a ultima fronteira util do stage nao usa parede dura como resposta principal
- o jogador pode entrar em vazio transitavel e retornar ao mundo util com tempo de volta comprimido
- o mapa novo melhora a leitura espacial sem quebrar coleta, movimento ou multiplayer
- a trilha `rpg-adventure.mp3` ou equivalente entra na experiencia de forma funcional

## Criterios de aceite detalhados para a primeira fatia

- existe um stage inicial autoral com landmarks reconheciveis
- o stage usa composicao baseada nos kits visuais disponiveis no projeto
- o stage apresenta elevacao mais forte do que o mapa atual
- a borda externa permite avancar para area vazia sem gerar bloqueio brusco
- retornar dessa borda para o mundo util leva menos tempo efetivo do que a ida profunda ao vazio
- o mapa continua compativel com o loop atual de coleta e progressao

## Riscos principais

- insistir em infinito verdadeiro cedo demais pode diluir conteudo e atrasar o que mais importa: um mundo memoravel
- adicionar riqueza visual sem pipeline de prefab e composicao pode virar mapa artesanal caro de manter
- tentar resolver borda apenas com teleporte invisivel pode quebrar a percepcao de mundo se o retorno nao for comunicado

## Observacoes

Este epic existe para trocar a sensacao de prototipo pela sensacao de mundo. O sucesso aqui nao e quantidade bruta de terreno, e sim entregar stages maiores, mais ricos e com bordas inteligiveis, para que os epics seguintes, incluindo a cidade, nascam em um mundo convincente.