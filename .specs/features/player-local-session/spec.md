# Player Local Session

Status: approved

## Objetivo

Formalizar a identificacao do jogador local no protocolo WebSocket para remover heuristicas no client e preparar as proximas fases de camera, HUD e mecanicas.

## Problema

Hoje o client recebe apenas snapshots de `players[]` e nao sabe, por contrato, qual jogador do array representa o usuario atual. Isso força heuristica visual por indice e impede evolucao segura para camera local, HUD local e diferenciacao clara entre "eu" e "outros".

## Usuario

Jogador conectado a uma sessao multiplayer local.

## Dor

O client consegue renderizar varios jogadores, mas nao consegue afirmar de forma confiavel qual jogador do snapshot representa o usuario atual.

## Metas

- Estabelecer um contrato explicito para identificar o jogador local ao conectar no WebSocket.
- Persistir essa identidade no estado do client.
- Garantir que o client continue consumindo snapshots autoritativos do servidor sem predicao local.
- Deixar a base pronta para camera e HUD local em fase posterior.

## Restricoes

- Nao incluir camera local nesta fase.
- Nao incluir HUD especifico do jogador nesta fase.
- Nao exigir extracao do estado do jogo para outro pacote backend nesta fase.
- Manter o servidor autoritativo: cliente so envia intencao.
- Preservar compatibilidade com o fluxo atual de `move` + `state`.

## Fora de Escopo

- Coleta de polen, flores, colmeia ou qualquer mecanica jogavel nova.
- Refactor estrutural maior do backend.
- Persistencia em banco.
- Predicao e interpolacao alem do que ja existe.
- Login e autenticacao.

## Criterios de Sucesso

- O servidor envia uma mensagem inicial separada com o identificador do jogador local.
- O client armazena esse identificador em estado de sessao.
- O client consegue distinguir, por contrato, jogador local de jogadores remotos.
- O fluxo atual de movimento continua funcionando.

## Historias

### P1. Identidade inicial da sessao

Como jogador conectado
Quero receber meu `playerId` ao abrir a conexao WebSocket
Para que o client saiba qual entidade do mundo eu controlo

### P2. Estado local confiavel no client

Como client do jogo
Quero guardar o `playerId` recebido na sessao
Para que o app diferencie meu estado do estado dos outros jogadores

### P3. Compatibilidade com snapshots atuais

Como time de desenvolvimento
Quero manter o fluxo atual de `move` e `state` funcionando junto com a nova mensagem inicial
Para que a fase avance sem quebrar o multiplayer minimo ja implementado

## Requisitos

- `REQ-PLS-001` WHEN uma conexao WebSocket for estabelecida THEN o servidor SHALL enviar uma mensagem inicial separada contendo o identificador do jogador local.
- `REQ-PLS-002` WHEN o servidor enviar a mensagem inicial da sessao THEN ela SHALL chegar antes ou no mesmo ciclo logico inicial em que o client comecar a consumir snapshots de estado.
- `REQ-PLS-003` WHEN o client receber a mensagem inicial da sessao THEN o client SHALL persistir o `playerId` em seu estado de sessao ativo.
- `REQ-PLS-004` WHEN o client receber mensagens `state` THEN o client SHALL continuar tratando o servidor como fonte de verdade para posicao e composicao da lista de jogadores.
- `REQ-PLS-005` WHEN o client comparar o `playerId` da sessao com os jogadores do snapshot THEN o client SHALL conseguir identificar de forma deterministica qual jogador e o local.
- `REQ-PLS-006` WHEN o jogador enviar uma acao `move` THEN o protocolo atual SHALL continuar funcional sem exigir mudancas no payload de movimento.
- `REQ-PLS-007` WHEN o servidor nao conseguir completar a sessao WebSocket THEN o client SHALL manter o estado local sem `playerId` valido e tratar a conexao como indisponivel.
- `REQ-PLS-008` WHEN multiplos clientes estiverem conectados THEN cada cliente SHALL receber seu proprio `playerId` de sessao e SHALL nao depender da posicao do jogador no array `players[]`.

## Criterios de Aceitacao

- `AC-PLS-001` WHEN um cliente conectar em `/ws` THEN o servidor SHALL enviar uma mensagem inicial separada com `playerId`.
- `AC-PLS-002` WHEN o client receber essa mensagem inicial THEN o estado de sessao SHALL expor esse `playerId`.
- `AC-PLS-003` WHEN o client receber um snapshot `state` contendo multiplos jogadores THEN o client SHALL conseguir determinar qual entrada representa o jogador local usando `playerId`.
- `AC-PLS-004` WHEN o usuario pressionar WASD ou setas THEN o client SHALL continuar enviando `move` e SHALL continuar reagindo ao `state` retornado pelo servidor.
- `AC-PLS-005` WHEN dois clientes estiverem conectados simultaneamente THEN cada um SHALL identificar seu proprio jogador sem usar heuristica por indice.
- `AC-PLS-006` WHEN a conexao cair antes da mensagem inicial THEN o client SHALL nao marcar nenhum jogador como local.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-PLS-001` | P1 | sessao comeca com identidade explicita |
| `REQ-PLS-002` | P1 | ordem minima do handshake fica definida |
| `REQ-PLS-003` | P2 | client guarda `playerId` |
| `REQ-PLS-004` | P3 | servidor segue autoritativo |
| `REQ-PLS-005` | P2 | jogador local e identificavel no snapshot |
| `REQ-PLS-006` | P3 | movimento atual continua compativel |
| `REQ-PLS-007` | P2 | falha de conexao nao cria estado invalido |
| `REQ-PLS-008` | P1, P2 | multiplos clientes nao dependem de ordem no array |

## Assuncoes

- A mensagem inicial pode ser algo como `session` ou `hello`; o nome exato do tipo sera decidido na implementacao.
- O snapshot `state` permanece como esta nesta fase.
- O backend continua no pacote atual por enquanto.