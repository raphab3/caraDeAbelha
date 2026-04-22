# Map Builder Pro - Design

Status: approved
Feature: map-builder-pro
Source: spec aprovada em chat nesta sessao em 2026-04-22

## Objetivo

Definir a arquitetura, a direcao visual e as decisoes nao obvias do Map Builder Pro, uma rota administrativa nova em `/admin/builder` para gerar uma base procedural, pintar props 3D com snap-to-grid e exportar um stage compativel com o contrato atual do servidor.

## Escopo desta fase

Esta fase fecha:

- como a nova rota entra no shell administrativo atual
- quais arquivos e componentes serao criados
- como o estado do editor sera modelado em Zustand
- como o canvas 3D vai tratar raycasting, snapping e antispam de pintura
- como a base procedural e os props serao renderizados sem divergir do runtime atual
- como a exportacao sera mapeada para o contrato real de `world_map.go`
- como a interface vai se comportar em desktop e mobile sem cair em uma tela generica de cards

Esta fase nao abre tarefas detalhadas e nao tenta redesenhar o pipeline atual de stage.

## Decisoes adotadas

### 1. Rota e convivencia com o admin atual

- O builder entra como nova rota dedicada em `/admin/builder`.
- `/admin/mapas` continua existindo como ferramenta separada para exploracao 2D do gerador procedural.
- O menu do [client/src/components/AdminLayout/index.tsx](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/components/AdminLayout/index.tsx) ganha um terceiro item para o builder.
- O shell visual do admin e preservado; o builder nao cria um layout paralelo.

### 2. Contrato de exportacao

- A exportacao usa o contrato atual do parser em [server/internal/httpserver/world_map.go](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/server/internal/httpserver/world_map.go), nao o JSON simplificado do prompt original.
- O arquivo exportado inclui `stageId`, `displayName`, `audio`, `edgeBehavior`, `tiles`, `props`, `zones`, `transitions` e `landmarks`.
- Nesta V1, `zones`, `transitions` e `landmarks` saem como arrays vazios.
- `props[].prefabId` e obrigatorio e deve vir de um catalogo local espelhando o catalogo suportado pelo servidor.

### 3. Modelo de interacao do editor

- A pintura usa `pointerDown`, `pointerUp` e `pointerOver` sobre uma camada de interacao horizontal invisivel.
- A unicidade de ocupacao e por `x:y:z`, permitindo empilhamento vertical.
- `mapInfo.defaultY` funciona como camada ativa de pintura para novos itens.
- O estado rapido do gesto de pintura nao entra no Zustand; ele fica em refs locais no canvas para evitar rerender e spam.

### 4. Alinhamento visual com o runtime

- O builder reutiliza as conversoes de [client/src/components/GameViewport/worldSurface.ts](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/components/GameViewport/worldSurface.ts) para garantir que terreno, alturas e props aparecam no editor com a mesma escala do jogo.
- O carregamento de GLTF e a estrategia de agrupamento por asset seguem o mesmo principio de [client/src/components/GameViewport/StagePropRenderer.tsx](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/components/GameViewport/StagePropRenderer.tsx), mas a edicao de itens continua simples e clicavel.

### 5. UX da ferramenta

- O builder sera uma workbench de viewport primeiro, nao uma dashboard de cards.
- A area dominante da tela e o canvas.
- O header funciona como command rail.
- O footer fixo vira uma asset shelf horizontal.
- O apoio de selecao e edicao fina acontece em um inspector flutuante dentro da area central, e nao em uma segunda pagina.

## Direcao visual

## Personalidade da tela

O builder deve parecer uma bancada de autoria tecnica, nao um formulario administrativo. A linguagem visual continua coerente com o admin atual: fundo escuro com gradientes quentes, bordas transluidas, acentos amber e azul, densidade moderada e hierarquia clara. A diferenca e que a superficie central passa a ser imersiva e operacional.

## Hierarquia da pagina

### Regiao primaria

- Canvas 3D com o grid, a base procedural e os props colocados.
- Overlay discreto com estado atual: ferramenta, asset selecionado, camada ativa `Y`, coordenada sob hover.
- GridHelper visivel, sem competir com os modelos.

### Regiao de suporte

- Inspector flutuante no topo direito da area central.
- Quando nao houver item selecionado, o inspector mostra instrucoes curtas de uso.
- Quando houver selecao, o inspector mostra `x`, `y`, `z`, `rotacao`, `escala`, `prefabId`, `tag` e `zoneId`.

### Regiao de comando

- Header com nome do mapa, seed, tamanho do grid, `defaultY`, botao `Gerar base` e botao `Exportar stage`.
- Segmento de ferramenta no header: `Pintar`, `Selecionar`, `Deletar`.

### Regiao de inventario

- Footer fixo com assets organizados por categoria: `terrain`, `nature`, `setdressing`, `landmark`, `border`.
- Cada botao mostra nome amigavel, badge de categoria e estado selecionado.
- A shelf e horizontal e rolavel em telas pequenas.

## Copy strategy

- Titulo da rota: `Map Builder Pro`.
- Subtitulo: texto curto, focado em autoria e exportacao de stage, sem jargao operacional longo.
- Empty state do canvas: `Base pronta. Escolha um prefab na shelf para comecar a pintar.`
- Empty state de selecao: `Nenhum item selecionado. Clique em um prefab para pintar ou troque para Selecionar.`
- Erro de exportacao: mensagens objetivas com o problema concreto, por exemplo `Nao foi possivel exportar: existe item fora dos limites do stage.`

## Responsividade

### Desktop

- Header em uma linha principal com wrap para controles secundarios.
- Inspector flutuante no canto superior direito do canvas.
- Shelf com altura fixa entre 96px e 120px.
- Canvas ocupa a maior parte do viewport util.

### Tablet

- Header quebra em duas linhas.
- Inspector permanece sobre o canvas, mas com largura menor.
- Shelf continua fixa e rolavel.

### Mobile

- Header vira stack vertical.
- Inspector vira painel recolhivel acima da shelf.
- Canvas mantem altura minima visivel de cerca de 50vh.
- Todos os controles clicaveis ficam com area minima de 44x44px.

## Estados de carregamento, vazio e erro

### Carregamento

- Enquanto os GLTFs da shelf e dos props carregam, o canvas mostra overlay curto de carregamento sem bloquear o resto da tela.
- O botao de exportacao continua desabilitado ate o estado minimo do editor estar consistente.

### Vazio

- A rota ja abre com uma base procedural default gerada localmente; nao existe tela vazia sem terreno.
- Se nao houver `placedItems`, o canvas mostra instrucoes de primeiro uso no overlay.

### Erro

- Se o catalogo local contiver um `prefabId` nao suportado, o item fica marcado como invalido no inspector e a exportacao e bloqueada.
- Se o usuario reduzir o tamanho do stage e itens sairem do limite, o sistema remove esses itens e exibe um aviso inline com a contagem removida.
- Se o browser nao suportar WebGL, a rota mostra um fallback textual com os controles principais e informa que a pintura 3D depende de renderizacao acelerada.

## Arquitetura proposta

## Estrutura de arquivos

Sem refatorar a arquitetura global atual do frontend, a nova ferramenta fica isolada em uma pasta propria.

```text
client/src/components/MapBuilder/
  index.tsx
  MapBuilderLayout.tsx
  BuilderCanvas.tsx
  PlacedItemsRenderer.tsx
  BaseTerrainRenderer.tsx
  SelectionInspector.tsx
  AssetShelf.tsx
  HeaderControls.tsx
  useMapBuilderStore.ts
  types.ts
  catalog.ts
  proceduralBase.ts
  exportStage.ts
```

### Motivo da estrutura

- `index.tsx` e o orquestrador da rota, como ja acontece em outros componentes do projeto.
- `MapBuilderLayout.tsx` concentra a composicao HTML e Tailwind.
- `BuilderCanvas.tsx` concentra apenas a cena R3F e os handlers de interacao.
- `PlacedItemsRenderer.tsx` cuida dos modelos editaveis e dos cliques de item.
- `BaseTerrainRenderer.tsx` fica separado porque a base procedural e um problema diferente de props colocados.
- `catalog.ts`, `proceduralBase.ts` e `exportStage.ts` mantem a regra fora da camada JSX.
- Nenhum arquivo novo deve se aproximar do limite de 800 linhas.

## Integracao com rotas existentes

- [client/src/App.tsx](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/App.tsx) ganha um lazy import para `MapBuilder`.
- O padrao segue o route wrapper usado hoje em `/admin/mapas`.
- O builder usa `AdminLayout`, mas a area interna nao reutiliza o `AdminInfoPanel`; ela precisa de um canvas dominante e de overlays proprios.

## Estado global em Zustand

O estado minimo pedido na spec nao e suficiente para sustentar renderizacao e exportacao da base procedural. O design expande a store com uma slice explicita para a base e com metadados de selecao.

```ts
interface MapInfo {
  name: string;
  size: number;
  defaultY: number;
}

interface ProceduralBaseState {
  seed: string;
  layoutStyle: "noise" | "connected-islands";
  tiles: MapTile[];
  stats: MapStats;
}

interface PlacedItem {
  id: string;
  prefabId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number; // graus no editor
  scale: number;
  meta: Record<string, unknown>;
  tag?: string;
  zoneId?: string;
}

interface EditorState {
  selectedAssetType: string | null;
  isPainting: boolean;
  currentTool: "paint" | "delete" | "select";
  selectedItemId: string | null;
  hoveredCell: { x: number; y: number; z: number } | null;
}

interface MapBuilderState {
  mapInfo: MapInfo;
  proceduralBase: ProceduralBaseState;
  placedItems: PlacedItem[];
  editorState: EditorState;
  placeItem: (item: Omit<PlacedItem, "id"> & { id?: string }) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, data: Partial<PlacedItem>) => void;
  clearMap: () => void;
  generateProceduralBase: (seed?: string) => void;
}
```

### Decisoes do estado

- `placedItems` continua array porque isso bate com a spec e simplifica exportacao.
- O estado canonicamente exportavel fica na store.
- O estado ultra frequente do gesto de pintura nao fica na store; ele sera mantido em refs dentro de `BuilderCanvas`.
- `clearMap()` limpa apenas `placedItems` e a selecao; a base procedural e os metadados do mapa permanecem.
- `generateProceduralBase()` atualiza `proceduralBase.tiles` e `proceduralBase.stats`.
- Se o tamanho novo do mapa cortar itens fora do limite, eles sao removidos com aviso explicito.

## Catalogo local de assets

O builder nao deve inventar um catalogo novo. Ele deve refletir o catalogo hoje aceito pelo backend em [server/internal/httpserver/world_map.go](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/server/internal/httpserver/world_map.go).

Catalogo inicial da shelf:

- `terrain/cliff-high`
- `terrain/slope-wide`
- `terrain/overhang-edge`
- `nature/pine-large`
- `nature/flowers-cluster`
- `nature/rocks-cluster`
- `setdressing/fence-broken`
- `setdressing/signpost`
- `setdressing/platform`
- `setdressing/platform-ramp`
- `setdressing/platform-overhang`
- `setdressing/fence-straight`
- `landmark/flag-beacon`
- `border/wind-gate`

Cada item do catalogo local inclui:

- `prefabId`
- `label`
- `assetPath`
- `category`
- `defaultScale`
- `defaultTag` quando houver

### Regras do catalogo

- O source of truth continua sendo o contrato do servidor.
- A UI mostra nomes amigaveis, mas o estado salva `prefabId`.
- `defaultScale` replica o valor do servidor para evitar divergencia visual.
- `meta` continua local e opcional; ele nao entra no export da V1 porque o parser atual nao suporta esse campo em `props`.

## Base procedural

O builder reaproveita a logica deterministica do gerador atual, mas nao precisa carregar toda a UI de tuning de [client/src/components/MapGenerator/index.tsx](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/components/MapGenerator/index.tsx).

### Decisao

- A V1 do builder expoe apenas `seed`, `size` e `defaultY` no header principal.
- A geracao usa um helper puro em `proceduralBase.ts`, derivado da implementacao atual do `MapGenerator`.
- O builder usa os thresholds default ja existentes; o tuning avancado continua sendo funcao de `/admin/mapas`.

### Motivo

- Mantem o builder focado em autoria 3D e exportacao.
- Evita duplicar toda a superficie de ajuste fino do gerador 2D.
- Reduz o risco de transformar o builder em duas ferramentas sobrepostas.

## Cena 3D e renderizacao

## Camera

- A camera inicial usa uma distancia derivada do tamanho do stage, seguindo a mesma intuicao de enquadramento de [client/src/components/GameViewport/index.tsx](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/components/GameViewport/index.tsx).
- `OrbitControls` fica com rotate e zoom ativos e pan desabilitado.
- O enquadramento inicial sempre mostra a maior parte do mapa sem exigir zoom manual.

## BaseTerrainRenderer

O builder nao deve reutilizar `InstancedWorldField` inteiro, porque esse componente carrega flores, hives, zonas, progresso do jogador e regras de runtime que nao pertencem ao editor.

Em vez disso, o builder cria um renderer especifico para a base:

- usa os helpers de [client/src/components/GameViewport/worldSurface.ts](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/src/components/GameViewport/worldSurface.ts)
- instancia terreno de grama e pedra com os mesmos modelos base do jogo
- representa agua como camada simples, coerente com o visual atual
- desenha `gridHelper` com divisao igual ao tamanho do mapa

### WYSIWYG adotado

- `x` e `z` sempre vivem em coordenadas de mundo inteiras.
- o renderer converte para scene usando `toSceneAxis()`.
- a altura do terreno usa `toTerrainBlockCenterY()` e `toTerrainSurfaceY()`.
- props com tag `terrain` pousam em `resolveSurfaceSceneY()` para que cliff, slope e overhang encaixem no relevo do mesmo jeito que o runtime faz.

## PlacedItemsRenderer

Apesar de o runtime agrupar props por asset path, a V1 do editor precisa privilegiar editabilidade e picking simples.

### Decisao

- `PlacedItemsRenderer.tsx` renderiza itens editaveis como grupos clonados por item, nao como instanced mesh clicavel.
- O carregamento do GLTF segue o padrao de `useGLTF` e preloads do renderer atual.
- Cada item recebe `onPointerDown` proprio.

### Motivo

- delete e select por item ficam muito mais simples
- a quantidade de props na V1 do editor e administravel
- o custo extra e aceitavel para uma ferramenta interna

Se o volume de props crescer muito depois, a otimização certa e um renderer hibrido, nao complicar o slice inicial.

## Modelo de interacao

## Plano de interacao

O input nao deve depender do mesh do terreno ou dos props. Para manter o gesto estavel, o canvas usa duas camadas separadas:

- uma `gridHelper` visivel para orientar o usuario
- um plano horizontal invisivel de interacao, posicionado um pouco acima da maior elevacao visivel

### Motivo

- o plano invisivel recebe o raycast primeiro
- o snap em `x` e `z` continua coerente mesmo sobre cliff e sobrehang
- a pintura nao falha por intersecao irregular com mesh de terreno

## Snapping

Como a cena usa escala visual diferente da coordenada exportada, o snap precisa voltar do scene space para world space antes do arredondamento.

Formula adotada no canvas:

```ts
const worldX = toWorldAxis(event.point.x);
const worldZ = toWorldAxis(event.point.z);

const snappedX = Math.round(worldX);
const snappedZ = Math.round(worldZ);
const snappedY = mapInfo.defaultY;
```

Chave de ocupacao:

```ts
const cellKey = `${snappedX}:${snappedY}:${snappedZ}`;
```

## Antispam de pintura

O problema principal desta feature e evitar repeticao infinita no mesmo ponto quando o ponteiro fica parado ou oscila no mesmo pixel.

### Decisao tecnica

`BuilderCanvas.tsx` mantem uma ref local por gesto:

```ts
interface PaintStrokeRef {
  active: boolean;
  visitedCellKeys: Set<string>;
  lastCellKey: string | null;
}
```

Fluxo adotado:

1. `pointerDown` inicia o gesto se a ferramenta e `paint`.
2. O primeiro cell commitado entra em `visitedCellKeys`.
3. `pointerOver` so tenta colocar item quando a chave mudou e ainda nao foi visitada neste gesto.
4. Antes do commit, o canvas consulta a ocupacao atual derivada de `placedItems`.
5. `pointerUp` e `pointerCancel` encerram o gesto e limpam a ref.

### Resultado esperado

- segurar o mouse parado nao gera dezenas de inserts
- arrastar lentamente por varias celulas continua funcionando
- a store recebe apenas mutacoes semanticas, nao ruido de hover

## Delete e select

- Cada item colocado recebe `onPointerDown={(e) => e.stopPropagation()}`.
- Se a ferramenta ativa for `delete`, o clique remove o item.
- Se a ferramenta ativa for `select`, o clique marca o item como selecionado e abre o inspector.
- Clique no vazio com `select` limpa a selecao.

## Regras de edicao fina

- `rotationY` no estado do editor fica em graus, para manter a UX legivel.
- O inspector oferece rotacoes por quarto de volta como acao principal.
- A exportacao converte `rotationY` para `yaw` em radianos.
- `scale` nasce com `defaultScale` do catalogo e pode ser ajustado no inspector.
- `tag` e `zoneId` aparecem apenas para tipos suportados; `meta` fica guardado mas nao ganha UI generica nesta V1.

## Exportacao

`exportStage.ts` recebe um snapshot puro da store e devolve o JSON final.

## Mapeamento adotado

```ts
{
  stageId: `stage:${slug}`,
  displayName: mapInfo.name,
  audio: { bgm: "assets/rpg-adventure.mp3" },
  edgeBehavior: {
    type: "outlands_return_corridor",
    playableBounds,
    outlandsBounds,
  },
  tiles: proceduralBase.tiles,
  props: placedItems.map(toWorldPrefabPlacement),
  zones: [],
  transitions: [],
  landmarks: [],
}
```

## Defaults de exportacao

- `stageId` = `stage:${slug-do-nome}`
- `displayName` = `mapInfo.name` ou `Novo Stage` se vazio
- `audio.bgm` = `assets/rpg-adventure.mp3`
- `playableBounds` = meia celula alem da borda do grid atual
- `outlandsBounds` = `playableBounds` expandido por um padding fixo de autoria

Formula de bounds:

```ts
const origin = -Math.floor(size / 2);
const end = origin + size - 1;

playable = {
  x1: origin - 0.5,
  x2: end + 0.5,
  z1: origin - 0.5,
  z2: end + 0.5,
};

outlands = expand(playable, Math.max(24, Math.ceil(size * 0.5)));
```

## Conversao de item para prop exportado

```ts
{
  id,
  prefabId,
  x,
  y,
  z,
  scale,
  yaw: degToRad(rotationY),
  tag,
  zoneId,
}
```

### Campo `meta`

- `meta` permanece no estado local por compatibilidade futura.
- A V1 do export nao escreve `meta` em `props` porque o contrato atual do servidor nao suporta esse campo.
- O design escolhe compatibilidade real com o parser atual em vez de gerar um JSON "quase certo".

## Dependencias novas

- `zustand` deve ser adicionada em [client/package.json](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/package.json).

Nao ha necessidade de novas dependencias para R3F, Drei ou GLTF; o projeto ja possui essas bibliotecas.

## Validacao esperada na execucao

Quando esta fase for implementada, a fase Execute deve conseguir provar pelo menos:

- a rota `/admin/builder` abre dentro do `AdminLayout`
- a shelf usa apenas `prefabId` suportado pelo servidor
- o gesto de pintura nao duplica item na mesma chave durante o mesmo hover parado
- `delete` nao sofre click-through para o plano de interacao
- o JSON exportado contem `stageId`, `displayName`, `tiles` e `props[].prefabId`
- `yaw` sai em radianos
- a base e os props aparecem com escala coerente em relacao ao runtime atual

## Riscos e mitigacoes

### Risco: desvio entre preview e runtime

Mitigacao:

- reaproveitar `worldSurface.ts`
- espelhar `defaultScale` do catalogo do servidor
- renderizar props com os mesmos asset paths do runtime

### Risco: store sofrendo com evento de hover de alta frequencia

Mitigacao:

- manter ref local de gesto no canvas
- evitar escrever hover transient em toda variacao de ponteiro

### Risco: export compatibilizar com a spec do prompt, mas nao com o parser real

Mitigacao:

- priorizar contrato real de [server/internal/httpserver/world_map.go](/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/server/internal/httpserver/world_map.go)
- deixar `meta` fora do payload exportado nesta V1

### Risco: builder virar copia inchada do gerador atual

Mitigacao:

- manter o builder com controles de base enxutos
- deixar tuning procedural avancado em `/admin/mapas`

## Proximo passo

A fase Design esta fechada e pronta para a fase `Execute`. O trabalho agora ja tem direcao suficiente para implementar a store Zustand, a nova rota, o layout do builder, o canvas com snapping estavel e a exportacao de stage sem reabrir ambiguidade estrutural.