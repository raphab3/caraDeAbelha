# Epic 07: Cidade-Colmeia Compartilhada e Comercio Basico

Status: planned
Epic ID: EPIC-CDAM-07
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Introduzir uma super colmeia compartilhada, sempre acessivel e segura, onde abelhas de todos os niveis possam se encontrar, retornar ao jogo e comprar itens utilitarios com mel.

## Resultado esperado

O jogador passa a perceber um centro social vivo e permanente no mundo, usa mel em compras concretas e ganha um ponto claro de retorno e preparacao entre expedicoes.

## Escopo

- cidade-colmeia compartilhada e sempre acessivel
- regras de zona segura dentro do hub
- retorno consistente para respawn e reconexao
- vendedores NPC fisicos com comercio autoritativo
- catalogo inicial de itens utilitarios comprado com mel
- feedback visual e de HUD para compras, falhas e servicos do hub

## Decisoes para a primeira implementacao

- a cidade sera sempre acessivel desde a primeira sessao
- a cidade sera o ponto oficial de respawn e reconexao
- a primeira versao tera NPCs fisicos como pontos de interacao
- a loja inicial vendera consumiveis e upgrades permanentes simples
- o servidor sera a unica fonte de verdade para catalogo, preco, compra e entrega
- a cidade nao substitui o mundo aberto nem o desbloqueio de zonas

## Primeira fatia executavel

- `zone:hive_city`
	- liberada por padrao
	- compartilhada entre jogadores de todos os niveis
	- segura, sem coleta e sem bloqueios de progressao territorial
- um vendedor de consumiveis basicos
	- vende pelo menos um item de recuperacao ou utilidade simples
- um vendedor de upgrades permanentes simples
	- vende pelo menos uma melhoria permanente de baixo risco, como aumento inicial de mochila
- fluxo de retorno confiavel
	- respawn e reconexao colocam o jogador na cidade-colmeia

Esta primeira fatia nao precisa resolver social completo, marketplace ou varios tipos de servico. Ela precisa provar que existe um hub central compartilhado, com compras autoritativas e papel real no loop do jogo.

## Problema

Hoje o mundo pode crescer em progressao territorial, mas ainda nao existe um espaco social central que concentre jogadores, organize servicos e de ao mel um destino comercial claro. Sem esse hub, o jogo corre o risco de parecer apenas um circuito de coleta distribuido pelo mapa.

## Usuarios afetados

- jogador novo, que precisa de um lugar seguro e legivel para entender o jogo
- jogador recorrente, que precisa de um ponto estavel para preparar a proxima sessao
- jogador avancado, que precisa de um espaco vivo onde a progressao dele encontre outros perfis de jogador

## Metas

- consolidar a fantasia de MMORPG de abelhas com uma super colmeia monumental
- criar um hub social central e reconhecivel
- validar o primeiro comercio com mel fora do desbloqueio de zonas
- estabelecer um ponto oficial de respawn e reconexao

## Restricoes

- o hub precisa aceitar jogadores de todos os niveis sem bloquear entrada
- compras devem ser totalmente autoritativas no servidor
- a primeira versao nao inclui trade entre jogadores nem marketplace
- a cidade nao deve concentrar toda a progressao do jogo
- o conteudo inicial do comercio deve ser pequeno e rebalanceavel

## Fora de escopo

- trade direto entre jogadores
- leilao ou marketplace global
- guildas, parties ou chat global completo
- crafting profundo
- quests completas e contratos do hub
- equipamentos e armas completos de build

## Modelo autoritativo esperado

- a cidade deve existir como `zone:hive_city` sempre liberada
- o jogador deve persistir ponto de retorno compativel com respawn e reconexao na cidade
- vendedores devem ter `vendorId`, `displayName`, `catalogId`, `zoneId` e posicao no mundo
- cada item do catalogo deve ter pelo menos `itemId`, `displayName`, `priceHoney`, `itemType`, `stackPolicy` e descricao curta
- a compra deve validar saldo, disponibilidade e regras de entrega no servidor
- o servidor deve decidir se o item entra no inventario, aplica efeito imediato ou atualiza upgrade permanente

## Fluxo principal

1. o jogador entra no jogo e aparece na cidade-colmeia
2. o jogador ve outros jogadores presentes no hub
3. o jogador encontra um NPC vendedor
4. o client mostra o catalogo autoritativo com nome, preco e efeito resumido
5. o jogador tenta comprar um item ou upgrade com mel
6. o servidor valida a compra, desconta o saldo correto e entrega o resultado
7. o jogador recebe confirmacao clara ou motivo de falha
8. o jogador sai da cidade para o mundo e pode retornar ao hub depois

## Contrato minimo esperado

- nova acao client -> server: `purchase_vendor_item`
- payload minimo: `type`, `vendorId`, `itemId`, `quantity` quando aplicavel
- resposta de sucesso ou falha pode reutilizar `interaction_result`, com `action: purchase_vendor_item`
- `player_status` deve continuar refletindo saldo de mel e estado resultante do upgrade comprado
- o client precisa receber o catalogo minimo dos vendedores e itens visiveis no hub
- o catalogo deve ser lido do servidor e nao calculado localmente

## Regras do hub

- a cidade e uma zona segura
- o jogador nao coleta nem aciona progresso territorial dentro da cidade
- respawn e reconexao colocam o jogador na cidade, nao em zona bloqueada
- jogadores com progressao diferente coexistem no mesmo hub
- compras falhas nao alteram saldo, inventario ou upgrades

## Feedback de UX esperado

- a cidade deve comunicar claramente escala monumental e funcao de hub central
- vendedores precisam ser reconheciveis como NPCs de servico
- ao mirar ou interagir com vendedor, o HUD mostra nome, funcao e CTA de compra
- ao falhar compra por mel insuficiente, o jogador recebe motivo claro
- ao concluir compra, o jogador recebe confirmacao curta e legivel
- o jogador deve entender que a cidade e um espaco seguro e de preparacao

## Dependencias

- Epic 02 com economia de mel consolidada
- contrato confiavel de `player_status` para saldo e estado do jogador
- base multiplayer suficiente para presenca compartilhada no hub
- sistema de entidades interativas capaz de suportar NPCs vendedores

## Criterios de aceite

- a cidade-colmeia esta acessivel desde a primeira sessao
- respawn e reconexao retornam o jogador para a cidade-colmeia
- jogadores de niveis diferentes conseguem coexistir no mesmo hub
- a cidade bloqueia coleta e progresso territorial por ser zona segura
- o jogador consegue comprar ao menos um consumivel e um upgrade permanente simples usando mel
- compras validas descontam mel corretamente uma unica vez
- compras invalidas retornam motivo claro e nao alteram o estado do jogador
- o jogador percebe a cidade como hub social e comercial, nao apenas como decoracao

## Criterios de aceite detalhados para a primeira fatia

- um jogador novo inicia ou retorna na `zone:hive_city`
- a `zone:hive_city` fica sempre acessivel para qualquer jogador
- o hub exibe ao menos um NPC vendedor de consumiveis e um NPC vendedor de upgrades
- o jogador consegue comprar pelo menos um item utilitario basico com mel suficiente
- o jogador consegue comprar pelo menos um upgrade permanente simples com mel suficiente
- tentar comprar sem mel suficiente falha sem alterar saldo
- tentar coletar dentro da cidade falha por regra de zona segura
- apos logout e reconexao, o jogador retorna para a cidade com saldo e compras preservados

## Riscos principais

- se a cidade assumir o papel do mundo aberto, a progressao territorial perde importancia
- se a loja inicial tiver escopo grande demais, ela invade o Epic 03 cedo demais
- se o hub nao comunicar seguranca e servico de forma forte, ele vira apenas mais um mapa bonito

## Observacoes

Este epic existe para dar identidade de MMORPG ao produto e um centro claro para a economia inicial. O sucesso aqui nao e quantidade de NPCs ou sistemas sociais, e sim provar que a super colmeia funciona como hub compartilhado, seguro e util para todos os niveis.