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

## Decisoes para a primeira implementacao

- existir uma zona inicial gratuita e sempre liberada: `zone:starter_meadow`
- a primeira zona compravel sera adjacente a inicial e servira como validacao do sistema inteiro
- o primeiro unlock usara apenas mel como moeda, sem item especial ou quest
- a compra sera permanente por jogador e persistida no backend
- o servidor sera a unica fonte de verdade sobre zonas liberadas, zona atual e acesso permitido
- o client podera antecipar feedback visual, mas nunca decidir acesso ou liberacao sozinho

## Primeira fatia executavel

- `zone:starter_meadow`
	- liberada por padrao
	- contem spawn, colmeia principal, colmeia coletora e flores basicas
- `zone:sunflower_ridge`
	- bloqueada por padrao
	- custo inicial de desbloqueio: `25 honey`
	- prerequisito inicial: possuir `zone:starter_meadow`, que todo jogador ja possui
	- contem densidade de flores maior que a zona inicial para deixar o ganho perceptivel

Esta primeira fatia nao precisa resolver arvore completa de zonas. Ela precisa provar, de ponta a ponta, que mel compra territorio e que o mundo muda de forma confiavel para aquele jogador.

## Modelo autoritativo esperado

- cada zona tera pelo menos `zoneId`, `displayName`, `unlockHoneyCost`, `requiredZoneIds`, `bounds` e `isStarter`
- `bounds` devem ser definidos no servidor e usados para validar acesso, interacao e coleta
- o estado do jogador deve persistir `currentZoneId` e `unlockedZoneIds`
- entidades do mundo devem carregar `zoneId` para que coleta, deposito e beneficios possam ser negados fora de zonas liberadas
- caso o jogador tente atravessar uma fronteira bloqueada, o servidor deve negar a progressao espacial para dentro da zona bloqueada
- caso o jogador tente interagir com algo de uma zona bloqueada por atraso de render ou snapshot antigo, o servidor deve negar a acao explicitamente

## Fluxo principal

1. o jogador se aproxima do gate entre `zone:starter_meadow` e `zone:sunflower_ridge`
2. o client mostra o gate visual e o custo de desbloqueio
3. o jogador aciona `unlock_zone` com o `zoneId` alvo
4. o servidor valida se a zona existe, se os prerequisitos foram cumpridos e se ha mel suficiente
5. em caso de sucesso, o servidor desconta o mel, persiste o desbloqueio e atualiza `unlockedZoneIds`
6. o jogador recebe feedback de sucesso e o gate deixa de bloquear sua passagem
7. em caso de falha, o mel nao muda e o client recebe motivo claro, como `mel_insuficiente` ou `prerequisito_ausente`

## Contrato minimo esperado

- nova acao client -> server: `unlock_zone`
- payload minimo: `type`, `zoneId`
- resposta de sucesso ou falha pode reutilizar `interaction_result`, com `action: unlock_zone`
- `player_status` deve continuar carregando `currentZoneId` e `unlockedZoneIds`
- o client precisa receber um catalogo minimo de zonas com `zoneId`, `displayName`, `unlockHoneyCost`, `requiredZoneIds` e dados suficientes para exibir o gate e o custo
- esse catalogo pode vir em mensagem dedicada no login ou anexado ao snapshot inicial, desde que a fonte continue sendo o servidor

## Regras de bloqueio

- o jogador sem unlock nao entra na zona bloqueada
- o jogador sem unlock nao coleta flores, nao deposita e nao usa beneficios de entidades daquela zona
- a barreira nao deve parecer colisao quebrada; ela precisa comunicar que e um gate economico proposital
- o jogador com unlock nao deve mais ver a barreira como bloqueio ativo naquela transicao
- se houver divergencia entre client e servidor, a regra do servidor prevalece e o client deve receber correcao de estado

## Feedback de UX esperado

- gate visivel no mundo com linguagem coerente ao tema, como parede de favo, nevoa dourada ou selo hexagonal
- ao mirar ou aproximar do gate bloqueado, o HUD mostra nome da zona, custo e CTA de liberacao
- ao falhar por falta de mel, o feedback deve dizer quanto falta ou ao menos deixar claro que a moeda e insuficiente
- ao desbloquear, o jogador precisa receber confirmacao curta e celebratoria, sem modal intrusivo obrigatorio
- o minimapa e o HUD devem refletir que a nova area ficou acessivel para aquele jogador

## Fora de escopo

- combate PvE
- quests e NPCs de objetivo
- equipamentos, builds e skill tree completos
- eventos globais e boss cooperativo

## Dependencias

- Epic 01 entregue com mel funcionando como moeda
- mapa com flores e colmeias ja consolidado no servidor e no client
- persistencia de `unlockedZoneIds` confiavel no estado do jogador
- pipeline do mundo capaz de associar entidades e gates a um `zoneId`

## Criterios de aceite

- zonas possuem `zoneId`, custo e condicao de desbloqueio definidos no servidor
- um jogador sem desbloqueio nao acessa a zona nem seus beneficios
- um jogador com mel suficiente consegue liberar a zona e recebe feedback claro
- o client mostra barreiras ou gates coerentes com o tema do mundo
- o servidor desconta mel apenas em desbloqueio valido e persiste a compra
- reconectar no jogo preserva as zonas ja liberadas
- o jogador desbloqueado consegue atravessar o gate e interagir com entidades da nova zona sem heuristica local
- tentativas invalidas retornam motivo claro e nao alteram saldo nem estado de unlock

## Criterios de aceite detalhados para a primeira fatia

- um jogador novo inicia com acesso apenas a `zone:starter_meadow`
- `zone:sunflower_ridge` custa `25 honey` na primeira versao
- com menos de `25 honey`, a acao `unlock_zone` falha e retorna feedback claro
- com `25 honey` ou mais, a acao `unlock_zone` desconta o valor correto uma unica vez
- apos desbloquear, o mesmo jogador pode cruzar o gate sem bloqueio adicional
- outro jogador novo continua vendo `zone:sunflower_ridge` como bloqueada
- flores e colmeias dentro de `zone:sunflower_ridge` ficam indisponiveis antes do unlock e disponiveis depois do unlock
- apos reconexao, o jogador continua com a zona liberada e o mel restante consistente

## Riscos principais

- fazer a restricao so no client deixaria o sistema vulneravel
- gates sem feedback visual forte podem parecer bugs de colisao ou mapa quebrado
- custo inicial mal calibrado pode tornar o primeiro unlock trivial ou cansativo demais; a primeira versao precisa ser facil de rebalancear
- misturar regra espacial com decoracao visual sem um `zoneId` consistente por entidade pode gerar bugs dificeis de rastrear

## Observacoes

Este epic consolida a economia do loop base e prepara o terreno para quests, inimigos mais fortes e eventos por area.

O sucesso deste epic nao e ter muitas zonas. E ter uma primeira zona paga, confiavel e claramente percebida como expansao real do mundo pelo jogador.