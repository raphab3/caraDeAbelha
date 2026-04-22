# Tasks - Map Builder Pro

Status: ready
Feature: map-builder-pro
Spec: `.specs/features/map-builder-pro/spec.md`
Design: `.specs/features/map-builder-pro/design.md`
Execution preference: `codebase + ui-ux-pro-max + Context7`

## Premissas de execucao

- executar em ordem, exceto quando a secao de paralelismo liberar sobreposicao
- reutilizar assets ja servidos em `client/public/kenney_platformer-kit`
- nao inventar `prefabId`; espelhar o catalogo atual de `server/internal/httpserver/world_map.go`
- usar `pnpm --dir client typecheck` como validacao estreita minima por slice
- usar `pnpm --dir client build` nas integracoes que cruzarem rota, canvas e exportacao

## Task list

- [x] `TASK-MBP-01` Bootstrap do dominio `MapBuilder` com tipos, catalogo, base procedural e store Zustand.
- [x] `TASK-MBP-02` Registrar a rota `/admin/builder` e montar a workbench administrativa com header, canvas region, inspector e asset shelf.
- [x] `TASK-MBP-03` Implementar a exportacao de stage alinhada ao contrato atual do parser Go.
- [x] `TASK-MBP-04` Implementar o canvas 3D com base procedural, snapping, gesto de pintura e antispam por `x:y:z` OBS: validar responsividade da tela e usar o modo tela cheia para criar mapas.
- [x] `TASK-MBP-05` Implementar renderizacao editavel dos props, delete sem click-through e inspector de selecao.
- [x] `TASK-MBP-06` Fechar a integracao end-to-end do builder e validar os criterios principais da spec.

## Detalhamento

### `TASK-MBP-01` Bootstrap do dominio `MapBuilder`

Deliverable: modulo base do builder com tipos fortes, catalogo local espelhado do backend, helper procedural reutilizavel e store Zustand pronta para consumo pelos componentes.

Requirement IDs:

- `REQ-MBP-002`
- `REQ-MBP-003`
- `REQ-MBP-004`
- `REQ-MBP-005`
- `REQ-MBP-006`
- `REQ-MBP-010`
- `REQ-MBP-017`
- `REQ-MBP-018`
- `REQ-MBP-019`

Arquivos principais:

- `client/package.json`
- `client/src/components/MapBuilder/types.ts`
- `client/src/components/MapBuilder/catalog.ts`
- `client/src/components/MapBuilder/proceduralBase.ts`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`

Depende de:

- nenhuma task anterior

Paralelismo:

- bloqueia todas as demais tasks

Reuso obrigatorio:

- `client/src/components/MapGenerator/index.tsx` para derivar a geracao procedural
- `server/internal/httpserver/world_map.go` para espelhar `prefabId`, `assetPath`, `category` e `defaultScale`
- `client/public/kenney_platformer-kit` como fonte unica de assets do builder na V1

Skills e MCPs preferidos:

- `Context7` apenas se surgir duvida especifica de API do Zustand
- sem necessidade de `ui-ux-pro-max` nesta task

Done when:

- `zustand` foi adicionada a `client/package.json`
- o modulo `useMapBuilderStore.ts` expõe `mapInfo`, `proceduralBase`, `placedItems`, `editorState` e as acoes da spec
- a base procedural para a mesma combinacao de `seed` e `size` produz o mesmo conjunto de `tiles`
- o catalogo local usa somente `prefabId` suportado hoje pelo backend
- `pnpm --dir client typecheck` passa

### `TASK-MBP-02` Registrar rota e workbench administrativa

Deliverable: rota nova em `/admin/builder` integrada ao admin atual, com layout de workbench focado no canvas e superficie pronta para acoplar store, inspector e shelf.

Requirement IDs:

- `REQ-MBP-001`
- `REQ-MBP-003`
- `REQ-MBP-005`
- `REQ-MBP-006`
- `REQ-MBP-017`

Arquivos principais:

- `client/src/App.tsx`
- `client/src/components/AdminLayout/index.tsx`
- `client/src/components/MapBuilder/index.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.tsx`
- `client/src/components/MapBuilder/HeaderControls.tsx`
- `client/src/components/MapBuilder/AssetShelf.tsx`
- `client/src/components/MapBuilder/SelectionInspector.tsx`

Depende de:

- `TASK-MBP-01`

Paralelismo:

- pode avançar em paralelo com `TASK-MBP-03` depois que a store e os tipos do dominio existirem

Reuso obrigatorio:

- `client/src/components/AdminLayout/index.tsx` para manter o shell admin
- `client/src/App.tsx` como padrao de roteamento lazy
- `ui-ux-pro-max` para copy curta, hierarquia e responsividade da nova superficie admin

Skills e MCPs preferidos:

- `ui-ux-pro-max` recomendado
- `Context7` nao necessario salvo duvida pontual de React Router

Done when:

- existe rota navegavel em `/admin/builder`
- o menu admin exibe o item do builder sem remover `/admin/mapas`
- o layout contem header operacional, area central dominante e asset shelf fixa/rolavel
- controles clicaveis essenciais respeitam alvo minimo de toque e foco visivel
- `pnpm --dir client typecheck` passa

### `TASK-MBP-03` Implementar exportacao de stage compativel com o parser atual

Deliverable: helper puro de exportacao e trigger de download no header, produzindo um container de stage valido para o contrato atual do servidor.

Requirement IDs:

- `REQ-MBP-014`
- `REQ-MBP-015`
- `REQ-MBP-016`
- `REQ-MBP-020`

Arquivos principais:

- `client/src/components/MapBuilder/exportStage.ts`
- `client/src/components/MapBuilder/HeaderControls.tsx`
- `client/src/components/MapBuilder/types.ts`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`

Depende de:

- `TASK-MBP-01`
- `TASK-MBP-02` apenas para conectar o botao final na UI

Paralelismo:

- o helper puro pode ser implementado em paralelo com `TASK-MBP-02`
- a ligacao final do botao depende da workbench de `TASK-MBP-02`

Reuso obrigatorio:

- `server/internal/httpserver/world_map.go`
- `.specs/features/cara-de-abelha-mmorpg-foundation/epics/07-evolucao-do-mundo-e-stages-autorais/pipeline.md`

Skills e MCPs preferidos:

- `Context7` nao necessario salvo se houver duvida de API do browser para download de arquivos
- sem necessidade de `ui-ux-pro-max`

Done when:

- o botao `Exportar stage` baixa um `.json`
- o payload inclui `stageId`, `displayName`, `audio`, `edgeBehavior`, `tiles`, `props`, `zones`, `transitions` e `landmarks`
- cada prop exportado sai com `prefabId`, `x`, `y`, `z`, `scale` e `yaw` em radianos
- `zones`, `transitions` e `landmarks` saem vazios na V1
- `pnpm --dir client typecheck` passa

### `TASK-MBP-04` Implementar canvas 3D com snapping e antispam

Deliverable: cena R3F do builder com terreno base, `gridHelper`, plano invisivel de interacao, snapping em coordenadas de mundo e gesto de pintura protegido contra repeticao na mesma chave `x:y:z`.

Requirement IDs:

- `REQ-MBP-007`
- `REQ-MBP-008`
- `REQ-MBP-009`
- `REQ-MBP-017`
- `REQ-MBP-018`
- `REQ-MBP-019`

Arquivos principais:

- `client/src/components/MapBuilder/BuilderCanvas.tsx`
- `client/src/components/MapBuilder/BaseTerrainRenderer.tsx`
- `client/src/components/MapBuilder/index.tsx`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`

Depende de:

- `TASK-MBP-01`
- `TASK-MBP-02`

Paralelismo:

- pode evoluir em paralelo com `TASK-MBP-03` depois que o shell da rota existir

Reuso obrigatorio:

- `client/src/components/GameViewport/worldSurface.ts`
- `client/src/components/GameViewport/index.tsx` para heuristica de camera e `OrbitControls`
- `client/src/components/GameViewport/InstancedWorldField.tsx` como referencia de base/instancing, sem importar as regras de runtime do jogador

Skills e MCPs preferidos:

- `Context7` recomendado se houver duvida de eventos de `@react-three/fiber`
- `ui-ux-pro-max` nao necessario nesta task

Done when:

- o canvas mostra base procedural e grid coerentes com o tamanho do mapa
- `pointerDown` inicia pintura, `pointerUp` encerra e `pointerOver` pinta apenas novas celulas visitadas no gesto atual
- segurar o ponteiro parado sobre a mesma celula nao cria itens duplicados
- sem asset selecionado, a ferramenta `paint` nao muta o estado
- `pnpm --dir client build` passa

### `TASK-MBP-05` Implementar props editaveis, delete e inspector

Deliverable: renderer de itens colocados com picking por item, delete sem click-through, selecao e painel de edicao fina para rotacao, escala e campos suportados.

Requirement IDs:

- `REQ-MBP-011`
- `REQ-MBP-012`
- `REQ-MBP-013`
- `REQ-MBP-018`
- `REQ-MBP-019`

Arquivos principais:

- `client/src/components/MapBuilder/PlacedItemsRenderer.tsx`
- `client/src/components/MapBuilder/SelectionInspector.tsx`
- `client/src/components/MapBuilder/BuilderCanvas.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.tsx`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`

Depende de:

- `TASK-MBP-01`
- `TASK-MBP-02`
- `TASK-MBP-04`

Paralelismo:

- sem paralelismo relevante; depende do canvas editavel estar funcional

Reuso obrigatorio:

- `client/src/components/GameViewport/StagePropRenderer.tsx` para estrategia de carga de GLTF e agrupamento mental por `assetPath`
- padrao de `stopPropagation()` nos itens clicaveis do prompt e do design aprovado

Skills e MCPs preferidos:

- `ui-ux-pro-max` recomendado para clareza do inspector e estados vazios
- `Context7` apenas se houver duvida de `useGLTF` ou eventos R3F

Done when:

- props colocados aparecem no viewport com `position`, `rotation` e `scale` vindos do estado
- clicar em um item com a ferramenta `delete` remove apenas o item alvo
- clicar em um item com a ferramenta `select` abre o inspector com dados editaveis
- ajustar rotacao ou escala reflete no viewport e no estado exportavel
- `pnpm --dir client build` passa

### `TASK-MBP-06` Fechar integracao e varrer criterios principais

Deliverable: rota `Map Builder Pro` integrada ponta a ponta, com UX minima consistente, estados vazios/erro polidos e evidencias de que os criterios principais da spec foram cobertos.

Requirement IDs:

- `REQ-MBP-001` a `REQ-MBP-020`

Arquivos principais:

- `client/src/components/MapBuilder/index.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.tsx`
- `client/src/components/MapBuilder/HeaderControls.tsx`
- `client/src/components/MapBuilder/AssetShelf.tsx`
- `client/src/components/MapBuilder/SelectionInspector.tsx`
- `client/src/App.tsx`
- `client/src/components/AdminLayout/index.tsx`

Depende de:

- `TASK-MBP-03`
- `TASK-MBP-04`
- `TASK-MBP-05`

Paralelismo:

- task final de fechamento; sem paralelismo

Reuso obrigatorio:

- `ui-ux-pro-max` para o copy pass final e ajuste de responsividade
- comando de validacao do client em `client/package.json`

Skills e MCPs preferidos:

- `ui-ux-pro-max` recomendado
- `Context7` opcional apenas se aparecer duvida de biblioteca durante o fechamento

Done when:

- a rota `/admin/builder` permite gerar base, selecionar asset, pintar, selecionar, deletar e exportar em uma unica sessao
- a asset shelf, o inspector e o header apresentam copy curta e legivel
- a exportacao final respeita o contrato do parser atual sem traducao manual posterior
- `pnpm --dir client typecheck` passa
- `pnpm --dir client build` passa

## Dependencias resumidas

- `TASK-MBP-01` -> base de tudo
- `TASK-MBP-02` depende de `TASK-MBP-01`
- `TASK-MBP-03` depende de `TASK-MBP-01` e conecta no fim com `TASK-MBP-02`
- `TASK-MBP-04` depende de `TASK-MBP-01` e `TASK-MBP-02`
- `TASK-MBP-05` depende de `TASK-MBP-01`, `TASK-MBP-02` e `TASK-MBP-04`
- `TASK-MBP-06` depende de `TASK-MBP-03`, `TASK-MBP-04` e `TASK-MBP-05`

## Paralelismo resumido

- depois de `TASK-MBP-01`, `TASK-MBP-02` e a parte pura de `TASK-MBP-03` podem andar juntas
- depois do shell de `TASK-MBP-02`, `TASK-MBP-04` pode avançar em paralelo ao fechamento da exportacao
- `TASK-MBP-05` e `TASK-MBP-06` ficam no caminho critico final

## Reuso e guardrails

- nao copiar assets novos enquanto o catalogo atual de `world_map.go` cobrir a V1
- nao criar formato JSON alternativo para o builder
- nao empurrar estado de hover de alta frequencia para Zustand
- nao reutilizar `InstancedWorldField` inteiro; reaproveitar apenas as convencoes e helpers certos
- preferir `pnpm --dir client typecheck` como validacao focada apos cada task e `pnpm --dir client build` nos fechamentos de integracao