# Tasks - Map Builder Pro Upgrade

Status: ready
Feature: map-builder-pro-upgrade
Spec: `.specs/features/map-builder-pro-upgrade/spec.md`
Design: nao criado ainda; executar com decisoes inline e promover para `design.md` se a semantica da rampa exigir fechamento adicional
Execution preference: `codebase + ui-ux-pro-max + Context7`

## Premissas de execucao

- executar em ordem, exceto quando a secao de paralelismo liberar sobreposicao
- evoluir o dominio existente em `client/src/components/MapBuilder/` sem abrir um segundo builder
- usar `pnpm --dir client typecheck` como validacao minima por slice
- usar `pnpm --dir client build` nas integracoes que cruzarem canvas, keyboard shortcuts e layout
- tratar a rampa como ponto de atencao: se a implementacao expuser conflito entre representacao visual e semantica jogavel, interromper a task e materializar `design.md`

## Task list

- [ ] `TASK-MBPU-01` Reestruturar o modelo de interacao do viewport para separar camera, acao primaria e navegacao por teclado.
- [ ] `TASK-MBPU-02` Introduzir selecao multipla, copia/colagem em lote e movimentacao de conjunto no estado do editor.
- [ ] `TASK-MBPU-03` Simplificar a toolbar e o modo sem UI, mantendo restauracao visivel e fluxo operacional por teclado.
- [ ] `TASK-MBPU-04` Ajustar snapping, marcacoes visuais e linguagem de selecao para comunicar centro de celula e destaque azul.
- [ ] `TASK-MBPU-05` Enxugar a biblioteca, remover itens invalidos e fechar coerencia funcional dos assets remanescentes.
- [ ] `TASK-MBPU-06` Refinar layout responsivo de `Biblioteca` e `Detalhes`, eliminar scrolls visiveis e validar criterios principais do upgrade.

## Detalhamento

### `TASK-MBPU-01` Reestruturar controles de viewport

Deliverable: canvas do builder com contrato de interacao previsivel, reservando o botao direito exclusivamente para rotacao da camera, o botao esquerdo para a acao ativa e as setas para navegacao do mapa.

Requirement IDs:

- `REQ-MBPU-001`
- `REQ-MBPU-002`
- `REQ-MBPU-008`
- `REQ-MBPU-010`

Arquivos principais:

- `client/src/components/MapBuilder/BuilderCanvas.tsx`
- `client/src/components/MapBuilder/index.tsx`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`

Depende de:

- nenhuma task anterior

Paralelismo:

- bloqueia `TASK-MBPU-02`, `TASK-MBPU-03` e `TASK-MBPU-04`

Reuso obrigatorio:

- `client/src/components/GameViewport/worldSurface.ts`
- `@react-three/drei` `OrbitControls` ja usados no builder atual

Skills e MCPs preferidos:

- `Context7` apenas se surgir duvida de eventos de ponteiro ou configuracao do `OrbitControls`
- sem necessidade de `ui-ux-pro-max`

Done when:

- o botao direito so rotaciona a camera
- o botao esquerdo so executa a acao ativa do editor
- o viewport nao aplica cursores especiais por modo
- as setas navegam pelo mapa sem editar o stage
- `pnpm --dir client typecheck` passa

### `TASK-MBPU-02` Introduzir selecao multipla e operacoes em lote

Deliverable: estado do editor expandido para suportar conjunto selecionado, entrada em modo de selecao por `Space`, copia/colagem em lote e movimentacao em grupo preservando offsets relativos.

Requirement IDs:

- `REQ-MBPU-004`
- `REQ-MBPU-005`
- `REQ-MBPU-006`
- `REQ-MBPU-007`

Arquivos principais:

- `client/src/components/MapBuilder/types.ts`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`
- `client/src/components/MapBuilder/BuilderCanvas.tsx`
- `client/src/components/MapBuilder/PlacedItemsRenderer.tsx`
- `client/src/components/MapBuilder/index.tsx`

Depende de:

- `TASK-MBPU-01`

Paralelismo:

- pode avançar em paralelo com parte de `TASK-MBPU-03` depois que o novo estado existir

Reuso obrigatorio:

- fluxo atual de copy/paste em `BuilderCanvas.tsx` como base de atalhos
- store Zustand existente do builder para evitar um segundo canal de estado

Skills e MCPs preferidos:

- `Context7` opcional se houver duvida de ergonomia para shortcuts ou eventos R3F
- sem necessidade de `ui-ux-pro-max` nesta task

Done when:

- `Space` ativa o modo de selecao sem depender da toolbar
- a store suporta selecao multipla persistida
- `Ctrl+C` e `Ctrl+V` funcionam com grupos selecionados
- mover um grupo preserva offsets internos
- deletar em lote remove apenas o conjunto selecionado
- `pnpm --dir client typecheck` passa

### `TASK-MBPU-03` Simplificar toolbar e modo sem UI

Deliverable: superficie de comandos reduzida a `Pintar` e `Deletar`, com entrada por teclado para selecao em lote e toggle de interface por `Ctrl+/` mantendo um unico affordance de restauracao.

Requirement IDs:

- `REQ-MBPU-003`
- `REQ-MBPU-004`
- `REQ-MBPU-009`

Arquivos principais:

- `client/src/components/MapBuilder/FooterToolbar.tsx`
- `client/src/components/MapBuilder/index.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.module.css`

Depende de:

- `TASK-MBPU-01`
- `TASK-MBPU-02` para alinhar o papel do `Space`

Paralelismo:

- pode rodar em paralelo com `TASK-MBPU-04` apos o contrato de estado ficar estavel

Reuso obrigatorio:

- toggle atual de `Ctrl+/` em `MapBuilder/index.tsx`
- layout atual da workbench para nao abrir uma hierarquia nova de componentes

Skills e MCPs preferidos:

- `ui-ux-pro-max` recomendado para manter hierarquia clara com menos UI visivel

Done when:

- a toolbar mostra apenas `Pintar` e `Deletar`
- `Ctrl+/` esconde as UIs auxiliares
- um unico controle visivel no topo direito restaura a interface
- o fluxo de selecao continua acessivel por teclado
- `pnpm --dir client typecheck` passa

### `TASK-MBPU-04` Ajustar snapping e estados visuais de selecao

Deliverable: canvas e renderer com snapping percebido no centro da celula, halo azul para item selecionado e separacao visual clara entre selecao, hover e delete.

Requirement IDs:

- `REQ-MBPU-011`
- `REQ-MBPU-012`
- `REQ-MBPU-013`

Arquivos principais:

- `client/src/components/MapBuilder/BuilderCanvas.tsx`
- `client/src/components/MapBuilder/PlacedItemsRenderer.tsx`
- `client/src/components/MapBuilder/SelectionInspector.tsx`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`

Depende de:

- `TASK-MBPU-01`

Paralelismo:

- pode avançar em paralelo com `TASK-MBPU-03`

Reuso obrigatorio:

- `client/src/components/GameViewport/worldSurface.ts` para manter coerencia espacial
- renderer atual de itens do builder como base para o novo sistema de destaque

Skills e MCPs preferidos:

- `ui-ux-pro-max` recomendado para contraste, legibilidade e estados de feedback

Done when:

- o placement comunica centro de celula, nao cruzamento de linhas
- item selecionado usa destaque azul
- hover e delete nao colidem visualmente com selecao
- o inspector e o canvas contam a mesma historia visual sobre o item ativo
- `pnpm --dir client build` passa

### `TASK-MBPU-05` Enxugar biblioteca e fechar coerencia funcional dos assets

Deliverable: catalogo revisado, `Beiral de Penhasco` removido, rampa tratada como asset distinguivel e biblioteca limitada a itens que funcionam ponta a ponta no fluxo do editor.

Requirement IDs:

- `REQ-MBPU-014`
- `REQ-MBPU-015`
- `REQ-MBPU-016`

Arquivos principais:

- `client/src/components/MapBuilder/catalog.ts`
- `client/src/components/MapBuilder/AssetShelf.tsx`
- `client/src/components/MapBuilder/useMapBuilderStore.ts`
- `client/src/components/MapBuilder/exportStage.ts`
- `client/src/components/MapBuilder/PlacedItemsRenderer.tsx`

Depende de:

- `TASK-MBPU-02`
- `TASK-MBPU-04`

Paralelismo:

- sem paralelismo relevante se a rampa demandar fechamento comportamental

Reuso obrigatorio:

- catalogo atual do builder
- contrato de exportacao existente para garantir que os itens remanescentes continuam exportaveis

Skills e MCPs preferidos:

- `ui-ux-pro-max` opcional para melhorar legibilidade da shelf
- promover para `design.md` se a rampa funcional exigir decisao extra sobre runtime ou exportacao

Done when:

- `terrain/overhang-edge` nao aparece mais na biblioteca
- a rampa e reconhecivel como transicao de subida na UX do editor
- os itens remanescentes da biblioteca funcionam do placement a exportacao
- nenhum item exposto na shelf fica quebrado ou sem fluxo coerente
- `pnpm --dir client typecheck` passa

### `TASK-MBPU-06` Refinar layout e validar o upgrade ponta a ponta

Deliverable: layout final do upgrade polido para desktop e mobile, sem scrolls visiveis em `Biblioteca` e `Detalhes`, e com evidencia de cobertura dos criterios principais da spec.

Requirement IDs:

- `REQ-MBPU-003`
- `REQ-MBPU-009`
- `REQ-MBPU-017`
- cobertura final dos criterios `AC-MBPU-001` a `AC-MBPU-014`

Arquivos principais:

- `client/src/components/MapBuilder/AssetShelf.tsx`
- `client/src/components/MapBuilder/SelectionInspector.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.tsx`
- `client/src/components/MapBuilder/MapBuilderLayout.module.css`
- `client/src/components/MapBuilder/index.tsx`

Depende de:

- `TASK-MBPU-03`
- `TASK-MBPU-04`
- `TASK-MBPU-05`

Paralelismo:

- task final de fechamento; sem paralelismo

Reuso obrigatorio:

- layout atual do builder e breakpoints ja existentes
- `ui-ux-pro-max` para densidade, responsividade e reducao de ruido visual

Skills e MCPs preferidos:

- `ui-ux-pro-max` recomendado

Done when:

- `Biblioteca` e `Detalhes` nao exibem scrollbars nativas visiveis nos breakpoints suportados
- o modo sem UI continua recuperavel por um unico controle no topo direito
- o builder suporta o fluxo completo do upgrade em uma sessao continua
- `pnpm --dir client typecheck` passa
- `pnpm --dir client build` passa

## Dependencias resumidas

- `TASK-MBPU-01` -> base do novo contrato de interacao
- `TASK-MBPU-02` depende de `TASK-MBPU-01`
- `TASK-MBPU-03` depende de `TASK-MBPU-01` e alinha com `TASK-MBPU-02`
- `TASK-MBPU-04` depende de `TASK-MBPU-01`
- `TASK-MBPU-05` depende de `TASK-MBPU-02` e `TASK-MBPU-04`
- `TASK-MBPU-06` depende de `TASK-MBPU-03`, `TASK-MBPU-04` e `TASK-MBPU-05`