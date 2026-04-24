# Click To Move Safe Routing

Status: proposed
Feature: click-to-move-safe-routing
Source: pedido em chat em 2026-04-24

## Objetivo

Formalizar uma evolucao do movimento por clique para que a abelha consiga alcancar destinos bloqueados por obstaculos por meio de uma rota valida, sem introduzir movimento autonomo inesperado, recalculos opacos ou perda do controle intencional do jogador.

## Relacao com a base atual

- Esta spec complementa [../cara-de-abelha-mmorpg-foundation/spec.md](../cara-de-abelha-mmorpg-foundation/spec.md).
- O comportamento atual de clique envia apenas um alvo final e depende de deslocamento em linha reta ate esse ponto.
- Esta iteracao adiciona resolucao de rota para clique no mundo, mas preserva o servidor como autoridade de movimento.

## Problema

Hoje, quando o jogador clica em um ponto do mapa, a abelha tenta seguir diretamente para o alvo. Se houver pedra, borda invalida, corredor de retorno ou qualquer outro bloqueio no trajeto, o movimento para antes de chegar ao destino. Isso torna o clique pouco confiavel em mapas com relevo, gargalos e caminhos indiretos.

Ao mesmo tempo, uma solucao ingenua de pathfinding pode piorar a jogabilidade: a abelha pode contornar demais, entrar em areas que o jogador nao pretendia, recalcular sozinha varias vezes ou continuar andando depois que a intencao original ja nao faz mais sentido.

## Usuario

Jogador controlando a abelha pelo clique no mapa no loop principal de exploracao.

## Dor

- O clique em um destino aparentemente alcancavel pode falhar porque o movimento atual segue em linha reta.
- O jogador nao sabe se o problema foi obstaculo, area invalida ou ausencia de rota.
- Um pathfinding sem limites pode causar trajetos longos, estranhos ou involuntarios.
- O time precisa de um contrato claro para implementar a melhoria sem degradar a sensacao de controle direto.

## Metas

- Permitir que o clique gere uma rota valida quando houver obstaculos entre a abelha e o destino.
- Garantir que o roteamento seja conservador, previsivel e sempre subordinado a uma intencao explicita do jogador.
- Definir quando o sistema deve mover, quando deve recusar o comando e quando deve parar com seguranca.
- Preservar o servidor como fonte de verdade para validacao de rota, zonas acessiveis e movimento final.
- Melhorar a leitura do resultado do clique com feedback quando o destino for invalido ou inalcancavel.

## Restricoes

- O movimento por clique SHALL continuar sendo iniciado apenas por uma acao explicita do jogador no mapa ou por interacoes equivalentes que ja representem um alvo intencional.
- O servidor SHALL continuar autoritativo para validacao de tiles atravessaveis, limites do mundo, regras de zona e execucao do movimento.
- A nova solucao SHALL evitar recalculo continuo em background sem novo comando explicito do jogador.
- A nova solucao SHALL priorizar previsibilidade sobre "esperteza"; quando houver duvida de intencao, o sistema deve recusar ou parar em vez de improvisar.
- A iteracao SHALL aproveitar a malha de mundo e as regras de atravessabilidade existentes, sem exigir um segundo sistema de navegacao desconectado do mapa real.

## Fora de Escopo

- Seguimento automatico persistente de alvos moveis.
- Desvio dinamico em tempo real contra outros jogadores.
- Navegacao autonoma, patrulha ou autoexploracao.
- Suavizacao cinematografica de rota ou animacoes especiais de virada.
- Rework amplo do formato do mapa.
- Pathfinding para entidades nao jogaveis nesta fase.

## Criterios de Sucesso

- O jogador consegue clicar atras de um obstaculo e a abelha chega ao destino por um caminho valido quando esse caminho existir.
- O jogador nao observa a abelha iniciar desvios sem clique explicito.
- O jogador recebe feedback claro quando o destino clicado nao pode ser atendido.
- O sistema interrompe a rota com seguranca se ela ficar invalida durante a execucao, sem continuar "forcando" movimento.
- O contrato final deixa claro quais casos aceitam rota, quais recusam e quais exigem parada imediata.

## Historias

### P1. Chegar ao destino por caminho valido

Como jogador
Quero que a abelha contorne obstaculos ao clicar no mapa
Para que eu consiga alcancar destinos validos sem depender apenas de linha reta

### P2. Manter controle intencional do movimento

Como jogador
Quero que a abelha siga apenas comandos que eu dei de forma explicita
Para que o sistema nao gere movimento involuntario ou surpreendente

### P3. Entender por que um clique falhou

Como jogador
Quero receber um retorno claro quando nao houver rota valida
Para que eu saiba se preciso clicar em outro ponto

## Requisitos

- `REQ-CTMSR-001` WHEN o jogador clicar em um destino no mapa THEN o sistema SHALL tratar esse clique como uma intencao explicita unica de navegacao para aquele destino.
- `REQ-CTMSR-002` WHEN existir linha reta valida entre posicao atual e destino THEN o sistema SHALL poder continuar usando o trajeto direto sem custo adicional de desvio perceptivel.
- `REQ-CTMSR-003` WHEN a linha reta entre origem e destino for bloqueada THEN o sistema SHALL tentar resolver uma rota valida composta por segmentos ou waypoints atravessaveis compativeis com o mapa atual.
- `REQ-CTMSR-004` WHEN o sistema resolver uma rota valida THEN a execucao SHALL seguir apenas os waypoints dessa rota e SHALL terminar ao atingir o destino final ou ao receber um novo comando explicito do jogador.
- `REQ-CTMSR-005` WHEN nao existir rota valida ate o destino clicado THEN a abelha SHALL nao iniciar deslocamento parcial especulativo e o sistema SHALL informar que o destino e inalcancavel nas regras atuais.
- `REQ-CTMSR-006` WHEN o jogador emitir um novo clique durante uma rota ativa THEN o novo clique SHALL substituir integralmente a rota anterior.
- `REQ-CTMSR-007` WHEN a rota ativa se tornar invalida durante a execucao por mudanca de regra de atravessabilidade, reposicionamento autoritativo ou perda de acesso a zona THEN o sistema SHALL interromper a rota atual com seguranca e SHALL nao recalcular automaticamente sem novo comando explicito.
- `REQ-CTMSR-008` WHEN o destino clicado estiver em tile nao atravessavel, fora dos limites validos ou atras de restricao de acesso THEN o sistema SHALL recusar o comando antes de iniciar movimento.
- `REQ-CTMSR-009` WHEN o sistema precisar escolher entre multiplas rotas validas THEN ele SHALL priorizar a rota de menor custo definida pela malha de movimento e SHALL evitar voltas desproporcionais ou caminhos que ampliem demais a distancia em relacao ao alvo.
- `REQ-CTMSR-010` WHEN a melhor rota valida ultrapassar um limite de custo, extensao ou complexidade definido para esta feature THEN o sistema SHALL recusar o comando em vez de executar um percurso surpreendente para o jogador.
- `REQ-CTMSR-011` WHEN o clique resultar em rota aceita THEN o feedback visual atual de destino SHALL continuar coerente com o alvo final escolhido e MAY ser enriquecido futuramente com indicacao de rota, sem tornar essa visualizacao obrigatoria nesta spec.
- `REQ-CTMSR-012` WHEN o clique for recusado por falta de rota ou destino invalido THEN o sistema SHALL emitir um feedback claro e curto para o jogador, distinguindo invalidez imediata de inalcancabilidade por bloqueio.
- `REQ-CTMSR-013` WHEN o cliente solicitar movimento por clique THEN o cliente SHALL continuar enviando intencao, e o servidor SHALL permanecer responsavel por validar o destino, resolver ou confirmar a rota e aplicar o movimento autoritativo.
- `REQ-CTMSR-014` WHEN a rota estiver em execucao THEN a progressao SHALL respeitar as mesmas regras de colisao, bounds, remapeamentos e acesso de zona que ja valem para movimento manual e alvo direto.
- `REQ-CTMSR-015` WHEN a implementacao introduzir discretizacao de rota em grid, nav graph ou estrutura equivalente THEN essa representacao SHALL derivar do layout jogavel real e SHALL nao permitir atalhos por tiles marcados como bloqueados.
- `REQ-CTMSR-016` WHEN o jogador parar manualmente, emitir outra acao de movimento ou perder a sessao THEN qualquer rota pendente SHALL ser descartada.

## Criterios de Aceitacao

- `AC-CTMSR-001` WHEN o jogador clicar do outro lado de uma pedra mas existir corredor atravessavel ate o destino THEN a abelha SHALL alcancar o ponto clicado por uma rota valida.
- `AC-CTMSR-002` WHEN o jogador clicar em um ponto com trajeto livre THEN a abelha SHALL seguir de forma equivalente ao comportamento atual, sem desvio desnecessario.
- `AC-CTMSR-003` WHEN o jogador clicar em um tile bloqueado THEN nenhum movimento SHALL iniciar e o jogo SHALL informar que o destino e invalido.
- `AC-CTMSR-004` WHEN o jogador clicar em um ponto valido, mas isolado por obstaculos sem conexao atravessavel THEN nenhum movimento SHALL iniciar e o jogo SHALL informar que nao existe rota disponivel.
- `AC-CTMSR-005` WHEN a abelha estiver seguindo uma rota e o jogador clicar em outro ponto THEN apenas o novo destino SHALL permanecer ativo.
- `AC-CTMSR-006` WHEN a rota ativa se tornar invalida durante a execucao THEN a abelha SHALL parar com seguranca e SHALL nao escolher um novo caminho sozinha.
- `AC-CTMSR-007` WHEN a unica rota disponivel exigir uma volta considerada excessiva pelo limite definido para a feature THEN o sistema SHALL recusar o comando em vez de executar um percurso surpreendente.
- `AC-CTMSR-008` WHEN o servidor rejeitar o destino por bounds, tile bloqueado ou regra de zona THEN o estado autoritativo SHALL prevalecer e o cliente SHALL convergir sem continuar tentando mover.
- `AC-CTMSR-009` WHEN uma rota valida for aceita THEN o marcador visual de destino SHALL continuar apontando para o destino final do clique, e nao apenas para um waypoint intermediario.
- `AC-CTMSR-010` WHEN a conexao cair ou o jogador perder a sessao durante uma rota THEN a navegacao pendente SHALL ser descartada.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-CTMSR-001` | P2 | clique vira comando explicito unico |
| `REQ-CTMSR-002` | P1 | trajeto simples permanece simples |
| `REQ-CTMSR-003` | P1 | obstaculo passa a admitir desvio valido |
| `REQ-CTMSR-004` | P1, P2 | rota executa so o que foi resolvido |
| `REQ-CTMSR-005` | P2, P3 | sistema nao inicia movimento especulativo |
| `REQ-CTMSR-006` | P2 | novo clique substitui rota anterior |
| `REQ-CTMSR-007` | P2 | rota invalida para sem autonomia extra |
| `REQ-CTMSR-008` | P3 | destino invalido e recusado cedo |
| `REQ-CTMSR-009` | P1 | escolha de rota permanece razoavel |
| `REQ-CTMSR-010` | P2 | rotas excessivas sao recusadas |
| `REQ-CTMSR-011` | P3 | feedback visual continua coerente |
| `REQ-CTMSR-012` | P3 | falha de clique fica compreensivel |
| `REQ-CTMSR-013` | P2 | servidor segue autoritativo |
| `REQ-CTMSR-014` | P1, P2 | regras atuais continuam valendo |
| `REQ-CTMSR-015` | P1 | desvio respeita o layout jogavel real |
| `REQ-CTMSR-016` | P2 | rotas pendentes nao sobrevivem a cancelamento |

## Assuncoes

- O problema atual nasce do fato de o movimento por clique depender de alvo unico em linha reta e ser cancelado ao encontrar posicao nao atravessavel.
- A primeira implementacao pode limitar o roteamento a obstaculos estaticos do mapa e a regras de acesso conhecidas no momento do clique.
- O limite de custo aceito para rota longa ou surpreendente sera fechado em `design.md` ou `tasks.md`, mas a regra de produto nesta spec e que o sistema deve preferir recusar a improvisar.
- O feedback ao jogador pode ser textual, visual ou combinado, desde que diferencie destino invalido de destino sem rota.