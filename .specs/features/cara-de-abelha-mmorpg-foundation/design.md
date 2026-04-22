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

## Addendum de Design - Epic 07: Cidade-Colmeia Compartilhada e Comercio Basico

Status: approved

Este addendum usa `EPIC-CDAM-07` como fonte obrigatoria de produto para detalhar a primeira versao da super colmeia compartilhada.

### Escopo

Esta fase cobre:

- a arquitetura da `zone:hive_city` como hub compartilhado e sempre acessivel
- o desenho de respawn e reconexao com retorno oficial para a cidade
- o modelo autoritativo de NPCs vendedores e catalogo basico de compras com mel
- as regras de zona segura no hub
- a direcao visual e de UX da cidade, do fluxo de compra e dos estados de interface

Nao cobre:

- trade entre jogadores
- marketplace ou leilao
- inventario completo de itens tradicionais
- quest hub completo
- guildas, chat global ou party system

### Contexto Atual

#### Codebase

- `server/internal/httpserver/world_runtime.go` ja controla entidades interativas runtime, inclusive a colmeia coletora adicionada fora do mapa base. Isso prova que o hub pode nascer com entidades especiais sem reescrever o mundo inteiro.
- `server/internal/httpserver/world_map.go` ja suporta `zones` e `transitions`, mas os `props` do mapa ainda aceitam apenas `flower`, `tree` e `hive`. NPC vendedor fisico ainda nao existe no formato do mapa.
- `server/internal/httpserver/ws_player.go` ainda trata `respawn` usando `profileSpawnPosition(profileKey)`, e `register(...)` restaura posicao persistida do jogador. Isso conflita diretamente com a decisao aprovada de sempre retornar para a cidade em respawn e reconexao.
- `server/internal/httpserver/persistence.go` ja persiste economia e posicao do jogador. O estado atual e suficiente para salvar progresso, mas ainda nao diferencia `ultimo ponto do mundo` de `ponto oficial de entrada no hub`.
- `server/internal/httpserver/ws_messages.go` ja define o padrao de acoes transacionais curtas como `collect_flower`, `unlock_zone`, `player_status` e `interaction_result`. O comercio do hub deve seguir esse mesmo modelo.
- `client/src/hooks/useGameSession.ts` ja separa `state`, `player_status`, `interaction_result` e `zone_state`, o que reduz o custo de adicionar um contrato de vendedores sem inflar o snapshot publico.
- `client/src/components/GameViewport/index.tsx` continua sendo o palco 3D principal com `MiniMap` e overlays de HUD em volta do canvas. Isso favorece uma cidade integrada ao mesmo mundo, nao uma tela paralela fora do viewport.
- `client/src/game/hud/ResourceRibbon.tsx` ja demonstra uma direcao visual mais apropriada para gameplay, com copy curta e leitura rapida. Esse padrao deve ser seguido pelo fluxo de compra.

#### Docs

- `ARCHITECTURE.md` reafirma a arquitetura server-authoritative e lista `ZoneGateRenderer`, `ZoneUnlockPanel` e `ZoneService` como superfícies do ecossistema, o que combina com um hub que convive com progressao territorial sem substitui-la.
- `docs/main.md` continua tratando mel como recurso central do loop e posiciona o jogo como multiplayer 3D compartilhado, o que reforca a necessidade de um centro social legivel.
- o `epic.md` do Epic 07 ja travou as decisoes centrais: cidade sempre acessivel, respawn e reconexao no hub, NPCs fisicos e comercio basico autoritativo.

#### Context7

- a documentacao do React Three Fiber reforca que o hub deve reutilizar geometria, materiais e `InstancedMesh` para elementos repetidos, evitando remontagem desnecessaria.
- a mesma documentacao reforca que atualizacoes frequentes de cena e presenca multiplayer devem continuar fora de `setState` em loops quentes, privilegiando mutacao controlada e estruturas estaveis.

#### Web

- a pagina oficial de pitfalls do R3F reforca tres restricoes relevantes para a cidade: evitar mount/unmount de partes inteiras da cena, nao criar objetos novos em loops de frame e nao mover atualizacao rapida para React state.

#### Incerteza Explicita

- ainda nao esta fechado se o jogador sempre retornara para a cidade em toda reconexao futura ou apenas na primeira versao; este design assume o retorno sempre para simplificar consistencia e onboarding.
- o catalogo inicial ainda nao tem tabela final de precos; o design precisa preservar rebalanceamento facil.
- o jogo ainda nao tem inventario geral. Isso muda materialmente como os "consumiveis" devem ser modelados na primeira fatia.

### Decisao Principal

Implementar a super colmeia como uma zona fisica do mesmo mundo autoritativo, `zone:hive_city`, e nao como cena separada, tela de menu ou instancia especial.

Essa zona sera:

- sempre acessivel
- segura
- compartilhada entre jogadores de todos os niveis
- ponto oficial de respawn e reconexao
- sede dos primeiros NPCs vendedores com compras autoritativas em mel

### Por Que Esta Decisao

- o codebase atual ja trabalha com mundo unico, chunks visiveis e snapshots por jogador; inserir a cidade no mesmo mundo exige menos risco do que abrir um segundo modo de cena
- a cidade precisa parecer parte do mundo, nao overlay de lobby
- manter tudo no mesmo protocolo simplifica presenca de outros jogadores, minimapa, transicoes e retorno ao jardim
- isso preserva o papel do Epic 02: a cidade e o centro social e comercial; as zonas continuam sendo o centro de progressao territorial

### Decisoes Nao Obvias

1. cidade no mesmo mundo, nao em instancia separada

- reduz custo arquitetural
- reaproveita chunks, camera, viewport e snapshot atual
- mantem a leitura de MMO sem troca brusca de modo

2. consumiveis sem inventario completo na primeira fatia

- o projeto ainda nao possui bolsa de itens, stack persistente ou slot de uso
- portanto, os consumiveis iniciais nao devem abrir um sistema de inventario acidentalmente
- eles serao compras de efeito imediato ou temporario, com semantica de consumivel, mas sem exigir backpack de itens

3. reconexao volta para a cidade, mesmo com posicao persistida

- a persistencia atual guarda coordenadas do mundo
- neste epic, a cidade precisa funcionar como ponto de retorno previsivel e de reentrada segura
- portanto, progresso economico continua sendo persistido, mas a entrada de sessao deve priorizar o spawn oficial da `zone:hive_city`

### Arquitetura Proposta

#### Backend

##### Mapa e zona da cidade

- adicionar `zone:hive_city` ao mapa autoritativo com bounds dedicados e transicoes claras para o mundo de coleta
- a cidade deve ficar em uma area curada do mapa, nao procedural, para controlar legibilidade, fluxo e densidade social
- os pontos de retorno do hub devem ser definidos como coordenadas autoritativas do mundo, separadas do `profileSpawnPosition(profileKey)` atual

##### Entidades do hub

Introduzir um novo tipo runtime e um novo estado publico minimo:

```go
type worldVendorState struct {
    ID            string  `json:"id"`
    X             float64 `json:"x"`
    Y             float64 `json:"y"`
    GroundY       float64 `json:"groundY"`
    ZoneID        string  `json:"zoneId"`
    DisplayName   string  `json:"displayName"`
    CatalogID     string  `json:"catalogId"`
    Role          string  `json:"role"`
    InteractRadius float64 `json:"interactRadius"`
}
```

Escolha arquitetural:

- vendedores devem existir como entidades de mundo, nao apenas botoes de HUD
- o mapa pode evoluir para aceitar `vendor` como prop autoritativo
- se isso atrasar demais a primeira fatia, a mesma estrategia usada para `collectorHive` pode ser usada para injetar vendedores runtime enquanto o formato do mapa e ampliado

##### Comercio autoritativo

Adicionar contrato transacional alinhado ao padrao atual:

```ts
interface PurchaseVendorItemAction {
  type: "purchase_vendor_item";
  vendorId: string;
  itemId: string;
  quantity?: number;
}
```

Mensagem de catalogo recomendada:

```ts
interface VendorCatalogMessage {
  type: "vendor_catalog";
  vendors: {
    vendorId: string;
    displayName: string;
    role: string;
    catalogId: string;
    entries: {
      itemId: string;
      displayName: string;
      description: string;
      priceHoney: number;
      fulfillment: "instant_effect" | "temporary_buff" | "permanent_upgrade";
    }[];
  }[];
}
```

Regras:

- o servidor valida distancia ate o NPC, saldo em mel e disponibilidade do item
- a compra desconta mel uma unica vez
- o resultado continua sendo comunicado com `interaction_result`
- `player_status` e enviado em seguida quando a compra muda estado persistente do jogador

##### Catalogo da primeira fatia

Para evitar invadir inventario e builds completos, a primeira fatia deve usar apenas dois fulfillment modes praticos:

- `temporary_buff`
  - exemplo: `Nectar Corrido`
  - efeito: bonus curto de velocidade para a sessao atual
- `permanent_upgrade`
  - exemplo: `Reforco de Mochila I`
  - efeito: `pollenCapacity +10`

Isso atende a decisao de vender consumiveis e upgrades permanentes simples sem exigir uma mochila de itens tradicional antes da hora.

##### Respawn e reconexao

O design recomendado e separar duas ideias que hoje estao misturadas:

- estado persistido de progresso
- ponto oficial de entrada na sessao

Regra desta fase:

- ao registrar ou reconectar, o jogador entra em `zone:hive_city`
- ao usar `respawn`, o jogador volta para `zone:hive_city`
- a posicao persistida do mundo pode continuar sendo salva para analise ou uso futuro, mas nao dirige a entrada da sessao nesta fatia

##### Zona segura

Dentro da `zone:hive_city`:

- negar `collect_flower`
- negar deposito automatico em colmeias de progressao
- negar desbloqueio territorial por proximidade ou gate local
- permitir apenas locomocao, interacao com NPCs e leitura social do hub

#### Frontend

##### Estado e protocolo

`useGameSession` deve continuar separando:

- `state` para cena compartilhada
- `player_status` para economia e stats do jogador
- `interaction_result` para feedback efemero
- `vendor_catalog` para UI de compras

Nao empurrar o catalogo inteiro para dentro do snapshot `state` principal.

##### Viewport e entidades

- `GameViewport` continua como palco unico
- `InstancedWorldField` ou renderer vizinho deve ganhar suporte a vendedores como entidades clicaveis
- NPCs vendedores devem ser visiveis e interagiveis no 3D antes da abertura da UI
- o hub deve privilegiar objetos estaveis e reuso de materiais, evitando mount/unmount de grandes blocos da cidade conforme o jogador se move

##### Superficie de compra

Direcao de UX:

- no desktop, a compra abre painel lateral leve ou cartela ancorada proxima ao NPC, nao tela cheia desconectada do mundo
- no mobile, a compra abre bottom sheet curta com titulo, preco, efeito e CTA
- o jogador deve continuar percebendo o mundo e o NPC por tras da interface

##### HUD e minimapa

- o minimapa deve sinalizar a cidade como hub seguro
- vendedores aparecem como POIs distintos
- a cidade precisa de uma leitura de retorno clara, equivalente ou superior ao botao atual de respawn
- feedbacks de compra entram no mesmo ecossistema visual de `ResourceRibbon` e `InteractionFeed`, sem introduzir paineis administrativos pesados

### Hierarquia da Cidade

Direcao visual do hub:

- regiao principal: praca central monumental com um grande nucleo de favo e leitura imediata de ponto seguro
- regiao de apoio 1: anel de mercado com dois NPCs facilmente distinguiveis
- regiao de apoio 2: eixos de saida para jardim e zonas futuras, como tuneis ou rampas de voo
- regiao de apoio 3: marcos visuais altos para orientacao rapida em multiplayer

O jogador deve entender a cidade em poucos segundos: aqui eu retorno, aqui eu encontro gente, aqui eu compro, daqui eu parto.

### Componentes de Destaque

1. `HiveCityArrivalBanner`

- aparece de forma curta ao entrar ou reconectar
- reforca que o jogador voltou para a cidade central

2. `VendorPrompt`

- mostra nome do NPC, funcao e CTA de interacao quando o jogador entra no raio util

3. `VendorSheet`

- lista curta de ofertas, preco em mel e efeito resumido
- a primeira fatia deve caber em uma unica leitura, sem scroll denso obrigatorio

4. `SafeZoneHint`

- deixa claro que a cidade e um ponto de preparo, nao de coleta

### Estrategia de Copy

Copy recomendada pelo fluxo atual:

- titulo da cidade: `Colmeia Central`
- CTA do vendedor: `Ver ofertas`
- prompt curto: `Conversar`
- vendedor de consumiveis: `Loja de Provisoes`
- vendedor de upgrades: `Oficina de Melhorias`
- loading do catalogo: `Carregando ofertas...`
- vazio: `Nada disponivel no momento.`
- sucesso: `Compra concluida!`
- erro de saldo: `Mel insuficiente.`
- chegada ao reconectar: `De volta a Colmeia Central.`
- hint de seguranca: `Zona segura. Sem combate.`

Tom:

- curto
- legivel
- tematico sem caricatura
- sem linguagem tecnica de sistema

### Loading, Empty e Error States

- ao entrar na cidade pela primeira vez: mostrar chegada curta, nao modal bloqueador
- ao abrir vendedor sem catalogo carregado: `Carregando ofertas...`
- se um catalogo vier vazio por regra ou erro controlado: `Nada disponivel no momento.`
- falha por saldo insuficiente usa feedback curto, sem modal de erro global
- se a sessao cair, `DisconnectModal` continua sendo a superficie bloqueadora primaria

### Responsividade

Desktop:

- painel de compra lateral ou proximo ao NPC
- vendors visiveis no mundo e no minimapa
- outros jogadores visiveis como parte da atmosfera social

Mobile:

- bottom sheet compacta
- CTA grande para compra
- texto em uma ou duas linhas por oferta
- touch target minimo de 44x44px para NPC e botoes de compra

### O Que Evita Placeholder Generico

- a cidade nao pode ser uma sala vazia com dois botoes e meia duzia de jogadores espalhados
- precisa de eixo monumental central, circulacao clara e leitura social imediata
- os NPCs devem parecer moradores e prestadores de servico da colmeia, nao quiosques abstratos
- o mercado deve parecer parte da arquitetura do hub, nao modal solto por cima do canvas

### Reuso Confirmado

Reaproveitar diretamente:

- `GameViewport` como palco 3D unico
- `MiniMap` como superficie secundaria para POIs e retorno
- `useGameSession` para roteamento das novas mensagens
- `player_status` e `interaction_result` como base de feedback apos compra
- a estrategia runtime de entidade especial ja validada pela colmeia coletora

Adaptar:

- `world_map.go` para suportar `vendor` como prop ou fonte equivalente de NPCs
- `ws_player.go` para mover respawn e reconexao para a cidade
- `persistence.go` para separar progresso persistido de ponto oficial de entrada
- `InstancedWorldField` para hit targets e render de vendedores

Evitar agora:

- sistema completo de inventario
- tela independente de loja fora do viewport
- qualquer fluxo que transforme a cidade em lobby morto ou menu principal glorificado

### Mudancas Estruturais Esperadas

#### Backend

- `server/internal/httpserver/world_map.go`
  - adicionar `vendor` como entidade de mapa ou registrar vendedores runtime da cidade

- `server/internal/httpserver/ws_messages.go`
  - adicionar `PurchaseVendorItemAction`
  - adicionar `VendorCatalogMessage`
  - adicionar `worldVendorState` ou estrutura equivalente exposta ao client

- `server/internal/httpserver/ws_connection.go`
  - rotear `purchase_vendor_item`

- `server/internal/httpserver/ws_player.go`
  - redefinir respawn e entrada da sessao para `zone:hive_city`

- `server/internal/httpserver/persistence.go`
  - continuar persistindo progresso
  - nao depender de coordenada persistida para spawn de reconexao nesta fase

#### Frontend

- `client/src/types/game.ts`
  - adicionar tipos de vendedor, catalogo e compra

- `client/src/hooks/useGameSession.ts`
  - armazenar `vendor_catalog`
  - expor action creator para compra em NPC

- `client/src/components/GameViewport/*`
  - renderizar NPCs vendedores e pontos de interacao

- `client/src/game/hud/*`
  - adicionar prompt e sheet de compra dentro da linguagem visual ja usada no HUD

### Erros e Falhas

Casos tratados:

- compra com mel insuficiente
- tentativa de comprar longe do NPC
- vendedor inexistente ou fora da zona atual
- catalogo desatualizado no client
- jogador tentando coletar dentro da cidade
- reconexao durante compra

Tratamento esperado:

- falhas de compra viram `interaction_result` curto e especifico
- `player_status` so e atualizado quando a compra altera o estado autoritativo
- se o catalogo do client estiver stale, o servidor rejeita e o client deve aceitar o estado corrigido

### Riscos

- se a cidade virar unica entrada e unica saida sem leitura espacial clara, ela vira atrito e nao hub
- se consumiveis exigirem inventario persistente cedo demais, o epic explode de escopo
- se NPCs forem renderizados como entidades totalmente independentes sem reuso de assets, a cidade perde desempenho quando muitos jogadores se acumularem

### Validacao

#### Backend

- teste de login e reconexao entrando na `zone:hive_city`
- teste de `respawn` retornando para a cidade
- teste de compra valida em vendedor dentro do alcance
- teste de compra invalida por saldo insuficiente
- teste de negacao de coleta dentro da cidade

#### Frontend

- `pnpm build`
- validacao manual em desktop com multiplos jogadores na cidade
- validacao manual em mobile do fluxo `aproximar NPC -> abrir ofertas -> comprar`
- validacao visual para garantir que a UI de loja nao desconecta o jogador do mundo 3D

### Proximo Passo Recomendado

O primeiro slice operacional do Epic 07 deve entrar nesta ordem:

1. `zone:hive_city` como ponto oficial de entrada e respawn
2. entidade de vendedor fisico no mundo
3. contrato `purchase_vendor_item` e catalogo autoritativo
4. um buff temporario e um upgrade permanente simples
5. sheet de compra leve no client

Essa ordem prova o valor do hub sem antecipar inventario completo, marketplace ou sistema social pesado.