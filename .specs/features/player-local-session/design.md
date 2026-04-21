# Design: Player Local Session

Status: approved

## Escopo

Esta fase cobre apenas protocolo e estado local para identificar o jogador controlado pelo cliente atual.

Inclui:

- nova mensagem inicial de sessao no WebSocket
- armazenamento de `playerId` local no client
- atualizacao do contrato tipado entre backend e frontend
- preparacao do client para diferenciar jogador local e remoto sem heuristica por indice

Nao inclui:

- camera local
- HUD especifico do jogador
- extracao do estado do jogo para outro pacote backend
- mecanicas jogaveis novas

## Contexto Atual

### Codebase

- O backend concentra transporte WebSocket e estado do jogo em `server/internal/httpserver/ws.go`.
- O handshake atual registra o cliente, cria `playerID` (`p1`, `p2`, etc.), incrementa `tick` e faz broadcast imediato de `state` para todos.
- O client usa `useGameSession` para conectar no socket, guardar `players[]` e `tick`, e enviar apenas a intencao `move`.
- `GameViewport` destaca visualmente o primeiro item do array, o que hoje e apenas uma heuristica e nao uma identidade confiavel.

### Docs

- `README.md` e `docs/main.md` apontam como proxima fase a identificacao explicita do jogador local.
- O contrato implementado e menor que a visao futura do documento principal; este design toma o codigo atual como fonte de verdade operacional.

### Context7

- A documentacao do `gorilla/websocket` reforca o padrao de um leitor concorrente e um escritor concorrente por conexao.
- O exemplo oficial recomenda centralizar leitura e escrita em loops dedicados ou em um caminho unico de escrita protegido.

## Decisao Principal

O servidor vai enviar uma mensagem inicial separada do tipo `session` para o cliente recem-conectado, contendo o `playerId` local.

Exemplo de contrato:

```json
{
  "type": "session",
  "playerId": "p3"
}
```

O snapshot `state` permanece sem `selfId` nesta fase.

## Por Que Mensagem Separada

- Mantem `state` focado em estado do mundo, nao em metadados da conexao.
- Evita inflar todo snapshot com informacao que so interessa ao cliente recem-conectado.
- Simplifica o uso futuro do protocolo para eventos de sessao sem misturar com o loop de mundo.
- Permite evolucao posterior para `session` incluir outros campos, como nome, seed local, loadout ou permissao de camera, sem tocar em `state`.

## Arquitetura Proposta

### Backend

O fluxo do `handleWebSocket` passa a ser:

1. Upgrade da conexao.
2. Registro do cliente no `gameHub` e criacao do `playerID`.
3. Envio direto da mensagem `session` apenas para o cliente conectado.
4. Broadcast do snapshot inicial `state` para todos os clientes.
5. Loop atual de leitura de `move` e broadcast de snapshots permanece igual.

Decisao operacional:

- a escrita da mensagem `session` deve usar o mesmo mecanismo protegido por `writeMu` do restante das escritas, para nao abrir concorrencia acidental entre envio direto e broadcast.

### Frontend

`useGameSession` passa a manter dois eixos de estado:

- estado da conexao e do mundo: `connectionState`, `tick`, `players[]`
- estado da sessao local: `localPlayerId`

`WSClient` continua apenas como wrapper de transporte e parsing de mensagens.

`GameViewport` ainda nao muda comportamento visual nesta fase, mas passa a receber dados suficientes para uma fase seguinte identificar o jogador local sem depender de indice.

## Contratos

### Servidor -> Cliente

Adicionar uniao de mensagens:

```ts
type ServerMessage = SessionMessage | WorldStateMessage;

interface SessionMessage {
  type: "session";
  playerId: string;
}
```

### Cliente -> Servidor

Sem mudanca nesta fase:

```ts
interface MoveAction {
  type: "move";
  dir: "up" | "down" | "left" | "right";
}
```

## Mudancas Estruturais Esperadas

### Backend

- `server/internal/httpserver/ws.go`
  - adicionar `sessionMessage`
  - adicionar funcao pequena para enviar mensagem a um cliente especifico
  - garantir ordem: `session` antes do primeiro `state` para o cliente novo

- `server/internal/httpserver/server_test.go`
  - adicionar teste que valida recebimento de `session`
  - adicionar teste para dois clientes garantindo ids distintos

### Frontend

- `client/src/types/game.ts`
  - adicionar `SessionMessage`
  - transformar `ServerMessage` em uniao discriminada
  - expandir `GameSessionState` com `localPlayerId?: string`

- `client/src/game/WSClient.ts`
  - sem nova responsabilidade de dominio
  - apenas aceitar a nova uniao tipada

- `client/src/hooks/useGameSession.ts`
  - consumir `session`
  - persistir `localPlayerId`
  - preservar comportamento atual de `state`

- `client/src/components/GameViewport/index.tsx`
  - sem requisito visual novo nesta fase
  - opcionalmente aceitar `localPlayerId` como prop se isso simplificar a proxima fase, mas sem comportamento obrigatorio agora

## Modelo de Estado no Client

Estado alvo:

```ts
interface GameSessionState {
  connectionState: "connecting" | "connected" | "disconnected";
  localPlayerId?: string;
  players: WorldPlayerState[];
  tick: number;
  error?: string;
}
```

Regras:

- `onOpen` nao implica sessao completa; a sessao so fica semanticamente identificada apos chegar `session`.
- `localPlayerId` deve ser limpo ao desconectar.
- `players[]` continua vindo exclusivamente de `state`.

## Ordem de Mensagens

Contrato de ordem desta fase:

- o cliente pode abrir o socket antes de saber seu `playerId`
- o servidor deve enviar `session` antes do primeiro `state` observado pelo cliente novo
- outros clientes existentes nao recebem `session` do cliente novo, apenas o `state` atualizado

Isso e suficiente para cumprir o requisito sem adicionar ack ou etapa de confirmacao extra.

## Erros e Falhas

Casos tratados:

- se a conexao fechar antes de `session`, `localPlayerId` permanece indefinido
- se chegar `state` antes de `session` por erro de implementacao, o client nao deve inferir o jogador local por indice
- se o `playerId` da sessao nao existir em `players[]` temporariamente, o client deve considerar isso valido ate o proximo snapshot, sem fallback heuristico

Casos explicitamente fora desta fase:

- reconnect automatico
- expiracao de sessao
- autenticacao
- renomeacao de jogador

## Impacto Visual

Nao ha redesign nesta fase.

Direcao visual:

- manter a superficie atual sem mudanca perceptivel obrigatoria
- evitar destacar o jogador local por heuristica de indice na implementacao seguinte
- preparar o viewport para, no proximo passo, seguir e marcar o jogador correto por identidade real

## Validacao

### Backend

- teste de handshake recebendo `session` seguido de `state`
- teste com dois clientes recebendo `playerId` distintos
- regressao do fluxo atual de `move`

### Frontend

- `npm run build`
- checagem tipada da uniao `SessionMessage | WorldStateMessage`
- validacao manual: dois clientes conectados recebem jogadores distintos e o estado local guarda `localPlayerId`

## Riscos

- o backend atual ainda mistura transporte e regra de jogo; a mudanca deve ser pequena para nao transformar esta fase em refactor estrutural.
- o caminho de escrita no websocket precisa manter seguranca de concorrencia; envio direto de `session` nao deve competir com broadcast sem usar o mesmo lock do cliente.
- como o client ainda nao usa `localPlayerId` visualmente, a feature pode parecer "invisivel" se nao houver ao menos confirmacao de estado/log para teste manual.

## Decisoes Nao Obvias

- Nao adicionar `selfId` em `state`: o objetivo desta fase e separar metadado de sessao de estado do mundo.
- Nao acoplar esta fase a camera/HUD: isso reduz superficie de mudanca e permite validar primeiro o contrato.
- Nao exigir extração para `internal/game` agora: seria um refactor util, mas desviaria o foco da spec e atrasaria a prova do protocolo.

## Proximo Passo

Apos esta fase, o proximo passo recomendado e usar `localPlayerId` para camera local e destaque visual confiavel no viewport, ja sem depender da ordem do array `players[]`.