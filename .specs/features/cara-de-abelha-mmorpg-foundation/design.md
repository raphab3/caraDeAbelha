# Design: Cara de Abelha MMORPG Foundation

Status: draft

## Escopo

Este design cobre a arquitetura de sistemas e a direcao de UX para a evolucao do Cara de Abelha como MMORPG cooperativo.

Inclui:

- a base arquitetural para os tres epics da iniciativa
- o detalhamento do primeiro slice obrigatorio: `coleta por clique na flor -> mochila -> conversao automatica em mel ao entrar na colmeia`
- a estrategia de mensagens WebSocket para separar mundo publico, estado local e feedbacks efemeros
- a direcao visual e de hierarquia da superficie principal do jogador
- os contratos basicos que preparam RPG, PvE, quests, helpers e eventos MMO sem implementa-los todos agora

Nao inclui:

- task breakdown
- formulas finais de balanceamento
- tabela completa de itens, skills, monstros, loot ou quests
- implementacao detalhada de persistencia completa
- redesign total das telas administrativas

## Contexto Atual

### Codebase

- O backend ainda concentra transporte WebSocket, estado de jogadores, mapa e snapshots em `server/internal/httpserver`.
- O protocolo atual ja possui `session`, `heartbeat` e `state`, com `players`, `chunks`, `flowers`, `trees` e `hives` em snapshots visiveis por chunk.
- O mundo ja renderiza flores e colmeias em `client/src/components/GameViewport/InstancedWorldField.tsx`, mas essas entidades ainda sao apenas props visuais.
- O client ja distingue jogador local por `localPlayerId`, mantem sessao em `useGameSession`, e usa `GameViewport` como superficie principal.
- O viewport ja trabalha com boas praticas de R3F para hot path: instancing, materiais compartilhados, mutacao em `useFrame` e overlays HTML pontuais.
- O HUD atual orientado ao jogador ainda e pequeno: minimapa, botao de tela cheia, login gate e modal de desconexao. O antigo `StatusPanel` ainda existe no repo, mas expoe linguagem tecnica demais para a superficie principal.

### Docs

- `docs/main.md` ja descreve a visao de coleta, mel, zonas, helpers e rankings, mas o codigo ainda esta em uma fase anterior.
- `README.md` deixa claro que o projeto atual valida principalmente movimento, cena 3D inicial, `/ws` e multiplayer minimo.
- A spec aprovada desta feature fixa o produto em tres epics e trava o primeiro slice como coleta mais conversao.

### Context7

- A documentacao do `gorilla/websocket` reforca que cada conexao deve ter no maximo um reader concorrente e um writer concorrente, com heartbeat, deadlines e escrita centralizada para evitar corrupcao de conexao.
- A documentacao do `@react-three/fiber` reforca que atualizacoes de alta frequencia devem continuar fora de `setState`, usando mutacao e refs em `useFrame`, com instancing e reaproveitamento de objetos.

### Web

- A documentacao oficial do `gorilla/websocket` confirma que mensagens de controle como ping, pong e close dependem de um read loop ativo e que escritas concorrentes devem ser evitadas.
- A pagina oficial de pitfalls do React Three Fiber confirma o caminho atual do projeto: nao empurrar loops quentes para React state, nao remontar geometrias indiscriminadamente e manter o viewport 3D como palco continuo, com overlays HTML leves e bem posicionados.

### Incerteza Explicita

- Formula de conversao `polen -> mel`, regen de flores e rendimento por clique ainda sao decisoes de balanceamento, nao de arquitetura.
- Ainda nao esta fechado se mel, level e equipamento de outros jogadores serao totalmente publicos ou apenas parcialmente publicos.
- A ordem de entrada de helpers, quests e combate dentro dos epics 2 e 3 pode ser refinada sem invalidar esta base.

## Decisao Principal

Separar a iniciativa em uma arquitetura de mensagens e modulos que diferencia:

1. estado publico do mundo e da cena
2. estado privado e orientado ao HUD do jogador local
3. eventos efemeros de feedback e recompensa

O mundo continuara sendo autoritativo no servidor, mas o protocolo deixara de forcar que toda informacao do HUD viva dentro de `state`.

## Por Que Esta Separacao

- `state` ja serve bem para cena compartilhada, jogadores remotos e visibilidade por chunks.
- polen, mochila, mel, quest ativa e pontos de skill sao dados prioritariamente locais e nao precisam inflar todos os snapshots publicos.
- feedbacks como `+5 polen`, `mochila cheia` ou `+12 mel` sao eventos curtos; forca-los como estado permanente complica o client.
- essa separacao tambem abre caminho para sistemas futuros sem transformar `state` em um payload monolitico.

## Arquitetura Proposta

### Backend

#### Camadas

Arquitetura alvo incremental:

```text
server/internal/httpserver/
  - upgrade HTTP -> WS
  - lifecycle de conexao
  - loops de leitura e escrita
  - serializacao JSON

server/internal/gameplay/
  world/
  player/
  loopbase/
  combat/
  quests/
  events/
  protocol/
```

Decisao pragmatica:

- `httpserver` continua sendo a borda de transporte nesta fase.
- a partir do Epic 1, as regras de coleta, conversao, zonas e status do jogador devem nascer em `internal/gameplay`, nao como mais branches dentro de `ws.go`.
- nao e necessario migrar tudo de uma vez; basta comecar pelo loop base e manter adaptadores pequenos entre `httpserver` e `gameplay`.

#### Modelos de dominio iniciais

```go
type PlayerProgress struct {
    PlayerID        string
    PollenCarried   int
    PollenCapacity  int
    Honey           int
    Level           int
    XP              int
    SkillPoints     int
    CurrentZoneID   string
    UnlockedZoneIDs []string
}

type FlowerNode struct {
    ID              string
    X               float64
    Y               float64
    GroundY         float64
    ZoneID          string
    PollenAvailable int
    PollenCapacity  int
    CollectRadius   float64
    RegenPerSecond  float64
    YieldPerClick   int
}

type HiveNode struct {
    ID            string
    X             float64
    Y             float64
    GroundY       float64
    ZoneID        string
    DepositRadius float64
    ConversionRate int
}
```

Modelos preparados para fases posteriores:

- `EnemyState`
- `EquipmentLoadout`
- `QuestProgress`
- `HelperState`
- `WorldEventState`
- `ContributionLedger`

#### Fluxo do MVP inicial

1. O client identifica uma flor clicavel no viewport.
2. O client envia `collect_flower` com `flowerId`.
3. O servidor valida:
   - sessao e jogador ativos
   - flor visivel e existente
   - distancia dentro do `CollectRadius`
   - mochila com espaco
4. O servidor calcula a transferencia de polen de forma autoritativa.
5. O servidor atualiza `PlayerProgress` e `FlowerNode`.
6. O servidor emite:
   - `player_status` para o jogador local
   - `interaction_result` para feedback imediato
   - `state` para quem precisa ver alteracao visual relevante no mundo
7. Quando o jogador entra no raio da colmeia, o servidor converte automaticamente o polen em mel e emite novo `player_status` e `interaction_result`.

#### Protocolo

Mensagens mantidas:

- `session`
- `heartbeat`
- `state`

Mensagens novas:

```ts
interface CollectFlowerAction {
  type: "collect_flower";
  flowerId: string;
}

interface PlayerStatusMessage {
  type: "player_status";
  playerId: string;
  pollenCarried: number;
  pollenCapacity: number;
  honey: number;
  level: number;
  xp: number;
  skillPoints: number;
  currentZoneId: string;
}

interface InteractionResultMessage {
  type: "interaction_result";
  result: "collect_success" | "backpack_full" | "flower_empty" | "out_of_range" | "deposit_success";
  deltaPollen?: number;
  deltaHoney?: number;
  sourceId?: string;
  message: string;
}
```

Contratos futuros ja previstos:

- `zone_state`
- `quest_state`
- `combat_state`
- `world_event`

Decisao nao obvia:

- nao usar `state` como unica fonte para HUD local.
- nao expor progresso inteiro de cada jogador remoto por padrao.

#### Broadcast e concorrencia

Como o servidor usa `gorilla/websocket`, a implementacao deve preservar um caminho claro de escrita por conexao.

Regras:

- manter um reader concorrente por conexao
- manter um writer concorrente por conexao
- nao introduzir goroutines ad hoc escrevendo direto em `conn`
- tratar heartbeat e deadlines dentro do lifecycle da conexao, sem competir com o broadcast principal

Consequencia pratica:

- `player_status` e `interaction_result` devem usar o mesmo mecanismo protegido de escrita que `session` e `state`
- se a base evoluir para fila de saida por cliente, esse design continua valido sem mudar os contratos de dominio

### Frontend

#### Estrutura proposta

Sem migracao total nesta fase, mas novas superficies do jogador devem seguir um modulo proprio:

```text
client/src/modules/gameplay/
  components/
    LoopBaseHud/
    ResourceRibbon/
    ObjectivePanel/
    InteractionFeed/
    HivePrompt/
  hooks/
    usePlayerStatus.ts
    useInteractionFeed.ts
  services/
    gameplayMessageRouter.ts
  types/
    gameplay.ts
```

Decisao pragmatica:

- `components/PlayerExperience` continua como shell da rota
- `components/GameViewport` continua como palco 3D
- os novos overlays e estados de HUD entram em `modules/gameplay`
- o repo pode migrar o restante depois, sem bloquear o MVP

#### Hierarquia da tela

Direcao visual do jogador:

- regiao principal: viewport 3D em tela cheia ou quase cheia
- regiao de apoio 1: HUD de recursos ancorada no topo esquerdo
- regiao de apoio 2: objetivo atual e status da colmeia no topo direito
- regiao de apoio 3: minimapa existente no canto inferior esquerdo
- regiao contextual: feed curto de coleta e deposito proximo ao centro inferior ou lateral direita

O viewport segue sendo o foco. O HUD deve parecer instrumentacao de voo da abelha, nao dashboard administrativo.

#### Componentes de destaque

1. `ResourceRibbon`

- mostra `Polen`, `Mochila` e `Mel`
- usa capsulas de leitura rapida, com no maximo uma linha auxiliar por item
- deve suportar estado de mochila cheia sem abrir modal

2. `ObjectivePanel`

- mostra o proximo passo do loop base
- no MVP, a logica principal e simples:
  - mochila vazia: `Clique em flores para coletar polen`
  - mochila parcial: `Continue enchendo a mochila`
  - mochila cheia: `Volte a colmeia`

3. `HivePrompt`

- componente contextual que aparece quando o jogador entra na area de deposito
- confirma que a conversao e automatica e mostra resultado do deposito

4. `InteractionFeed`

- lista curta e efemera com mensagens como `+5 polen`, `Mochila cheia` e `+12 mel`
- nao substitui o HUD; apenas reforca eventos recentes

5. `MiniMap`

- permanece como regiao secundaria reutilizavel
- continua recolhido por padrao em mobile
- nao deve virar painel de status generico

#### Estrategia de copy

Tom de voz:

- curto, direto e levemente tematico
- mais `Voltar a colmeia` do que `Gerenciar recursos da base`
- evitar jargao tecnico como `tick`, `backend`, `chunk` ou `websocket`

Labels candidatas aprovadas para esta direcao:

- `Polen`
- `Mochila`
- `Mel`
- `Colmeia`
- `Objetivo atual`
- `Voltar a colmeia`
- `Depositar polen`
- `Fazer mel`
- `Mochila cheia`
- `Ver objetivo`

Estados curtos recomendados:

- loading: `Atualizando a colmeia...`
- loading: `Buscando o objetivo...`
- empty: `Sua mochila esta vazia.`
- empty: `Nenhum objetivo por agora.`
- error: `Nao deu para atualizar a colmeia. Tente de novo.`
- error: `O objetivo nao carregou. Tente novamente.`

#### Loading, empty e error states

MVP inicial:

- enquanto `player_status` nao chega: HUD mostra placeholders compactos, nao cards grandes
- quando a mochila esta vazia: objetivo convida a clicar em flores
- quando a flor clicada esta fora de alcance: feedback curto, sem modal
- quando a mochila esta cheia: aviso persistente de baixo ruido e CTA de retorno a colmeia
- se a sessao cair: `DisconnectModal` segue como bloqueador principal; nao duplicar esse erro em overlays menores

#### Responsividade

Desktop:

- `ResourceRibbon` no topo esquerdo
- `ObjectivePanel` no topo direito
- `MiniMap` no canto inferior esquerdo
- `InteractionFeed` na lateral direita ou rodape central, conforme densidade do HUD

Mobile e tela cheia:

- recurso em duas linhas compactas
- objetivo atual em faixa recolhivel
- minimapa recolhido por padrao
- touch targets de no minimo 44x44px
- clique em flor usa o mesmo modelo de tap targeting tolerante ja existente, com hit area dedicada no asset da flor

#### O que evita placeholder generico

- nada de pilha de cards administrativos flutuando sobre o jogo
- o HUD deve usar linguagem de colmeia: capsulas, favos sutis, brilho dourado e leitura rapida
- os overlays precisam servir a acao imediata do jogador, nao restatar o que ele ja ve no mundo
- o foco permanece no jardim e na abelha; o HUD so complementa a decisao

## Reuso Confirmado

Reaproveitar diretamente:

- `PlayerExperience` para shell, fullscreen, login e reconexao
- `GameViewport` para camera, actor local, players remotos, target marker e canvas principal
- `MiniMap` como modulo secundario do HUD
- `useTapTargeting` para experiencia touch tolerante
- `InstancedWorldField` para flores e colmeias como primeira superficie clicavel
- `useGameSession` como base do roteamento de mensagens da sessao

Adaptar:

- `InstancedWorldField` precisa separar handlers de terreno e handlers de entidades interativas, para que clicar em flor nao dispare movimento de chao por engano
- `useGameSession` precisa aceitar `player_status` e `interaction_result`
- `types/game.ts` precisa deixar claro o contrato entre mensagens publicas de mundo e mensagens privadas de HUD

Evitar reuso direto na superficie do jogador:

- `StatusPanel`, porque sua copy e sua estrutura ainda sao internas e tecnicas demais para a fase de gameplay

## Mudancas Estruturais Esperadas

### Backend

- `server/internal/httpserver/ws_messages.go`
  - adicionar DTOs de `CollectFlowerAction`, `PlayerStatusMessage` e `InteractionResultMessage`

- `server/internal/httpserver`
  - manter handshake, heartbeat e broadcast, mas delegar regra de coleta e deposito a `internal/gameplay`

- `server/internal/gameplay/loopbase`
  - validar clique em flor
  - aplicar limite de mochila
  - regenerar flor
  - converter polen em mel ao entrar em colmeia

- `server/internal/gameplay/world`
  - promover flores e colmeias de props para nodes interativos
  - adicionar `ZoneID` e raios de interacao

### Frontend

- `client/src/types/game.ts`
  - adicionar uniao tipada para `player_status` e `interaction_result`

- `client/src/hooks/useGameSession.ts`
  - manter `state` para cena compartilhada
  - armazenar `player_status` local de forma separada
  - tratar resultados efemeros sem empurrar cada evento para o render loop 3D

- `client/src/components/GameViewport/InstancedWorldField.tsx`
  - expor hit targets de flores e colmeias
  - diferenciar `terrainPointerHandlers` de `entityPointerHandlers`

- `client/src/modules/gameplay/*`
  - introduzir a HUD do loop base fora de `GameViewport`, mas sobre o mesmo shell visual

## Erros e Falhas

Casos tratados:

- clique em flor fora de alcance
- clique em flor inexistente ou nao visivel
- mochila cheia
- flor esgotada
- deposito automatico com mochila vazia
- queda de conexao durante a coleta

Tratamento esperado:

- erros de interacao viram `interaction_result` local, nao modal global
- queda de conexao continua com `DisconnectModal`
- falha de ordem entre `player_status` e `state` nao deve quebrar o HUD; o client deve considerar o ultimo `player_status` como fonte da barra de recursos

## Riscos

- sem separacao inicial entre transporte e regras de jogo, o pacote `httpserver` vai crescer rapido demais nos epics seguintes
- se a coleta em flor reutilizar exatamente os mesmos handlers do chao, mobile pode alternar entre mover e coletar de forma inconsistente
- se o HUD local depender de `state` global para tudo, o payload vai inflar e a semantica entre publico e privado ficara confusa
- overlays HTML demais sobre o canvas podem degradar a leitura visual e competir com toque em telas menores

## Validacao

### Backend

- teste de coleta bem-sucedida dentro do alcance
- teste de clique fora do alcance
- teste de mochila cheia
- teste de deposito automatico ao entrar em colmeia
- teste de privacidade: `player_status` vai apenas para o cliente local
- teste de regressao do fluxo atual de movimento, sessao e heartbeat

### Frontend

- `pnpm build`
- validacao manual em desktop: clicar em flor atualiza HUD e feed
- validacao manual em mobile: tap em flor nao dispara movimento de chao por engano
- validacao visual: o HUD continua legivel em tela cheia sem esconder o viewport nem competir com o minimapa

## Decisoes Nao Obvias

- separar `player_status` de `state` desde cedo: isso protege a evolucao para quests, equipamentos e skills sem poluir snapshots publicos
- usar colmeia com deposito automatico no MVP: reduz friccao e valida a matematica de conversao com menos UI bloqueadora
- manter o viewport como foco e introduzir HUD modular: a fantasia do jogo depende do mundo 3D, nao de paineis administrativos
- introduzir `internal/gameplay` agora como alvo incremental: o custo e menor do que tentar encaixar combate, quests e world boss direto em `httpserver`

## Proximo Passo Recomendado

O proximo passo operacional e abrir o epic do loop base com implementacao de:

1. `collect_flower` autoritativo
2. `player_status` local
3. `interaction_result` efemero
4. HUD de recursos e objetivo atual

Isso valida o coracao economico do jogo sem antecipar combate, pets ou world boss.