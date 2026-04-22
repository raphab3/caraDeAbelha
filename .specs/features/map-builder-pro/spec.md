# Map Builder Pro

Status: approved
Feature: map-builder-pro
Source: especificacao consolidada em chat em 2026-04-22

## Objetivo

Formalizar uma ferramenta administrativa de autoria de stages para o Cara de Abelha, permitindo que o time gere uma base procedural, pinte props 3D sobre um grid com snapping e exporte um stage compatível com o contrato atual do servidor.

## Problema

O projeto ja possui pipeline de stages autorais e catalogo de prefabs no servidor, mas ainda nao possui uma rota administrativa dedicada para compor visualmente novos mapas. Sem esse editor, a producao de stages continua dependente de edicao manual de JSON e de um fluxo pouco eficiente para iterar terreno, props e leitura espacial.

## Usuario

Administrador ou operador interno responsavel por criar, revisar e exportar stages do mundo.

## Dor

- O time nao consegue iterar visualmente sobre o stage usando o mesmo grid conceitual do runtime.
- A composicao de props ricos ainda depende de edicao manual e propensa a erro.
- Nao existe uma ferramenta administrativa para pintar assets sem duplicacao acidental durante arraste.
- O pipeline atual do servidor exige `prefabId` e contrato de stage especifico, mas nao ha uma UI que garanta essa compatibilidade na origem.

## Metas

- Criar uma nova rota administrativa em `/admin/builder` sem substituir `/admin/mapas`.
- Permitir gerar uma base procedural deterministica para um stage de tamanho `n x n`.
- Permitir pintar, selecionar e deletar props 3D com snap-to-grid.
- Evitar duplicacao de itens quando o ponteiro fica parado na mesma celula durante pintura.
- Exportar um arquivo JSON compatível com o contrato atual de stage do servidor.
- Manter o editor alinhado ao catalogo de prefabs ja suportado pelo backend.

## Restricoes

- A UI SHALL usar React com TailwindCSS.
- O estado global do editor SHALL ser centralizado em Zustand.
- O viewport 3D SHALL usar `@react-three/fiber` e `@react-three/drei`.
- A nova ferramenta SHALL conviver com a rota administrativa atual e nao substituir o gerador existente nesta fase.
- O formato de exportacao SHALL seguir o contrato atual de stage do servidor, e nao o JSON simplificado do prompt inicial.
- A unicidade de ocupacao SHALL ser validada por `x,y,z`, permitindo empilhamento vertical.
- O catalogo inicial de assets SHALL mapear rotulos amigaveis da UI para `prefabId` suportados pelo servidor atual.

## Fora de Escopo

- Importacao de stage existente para edicao nesta primeira versao.
- Edicao colaborativa em tempo real.
- Undo/redo.
- Gizmos avancados de transformacao 3D.
- Upload arbitrario de novos `.glb`.
- Persistencia automatica em servidor ou banco.
- Rework do contrato do parser Go para aceitar um segundo formato de mapa.

## Criterios de Sucesso

- O admin consegue abrir `/admin/builder`, definir nome e tamanho do mapa e gerar uma base procedural.
- O admin consegue selecionar um asset valido, pintar no grid e deletar itens sem click-through para o plano.
- Segurar o mouse parado sobre a mesma celula nao cria duplicatas.
- O editor permite empilhar itens em alturas diferentes quando `y` for diferente.
- O arquivo exportado pode ser consumido pelo pipeline atual de stages do servidor sem exigir traducao manual fora da ferramenta.
- A rota existente `/admin/mapas` continua acessivel.

## Historias

### P1. Preparar um stage editavel

Como administrador
Quero abrir uma rota dedicada do builder, definir metadados do mapa e gerar uma base procedural
Para que eu possa iniciar um stage novo sem editar JSON manualmente

### P2. Compor props no grid com seguranca

Como administrador
Quero pintar, selecionar e deletar props 3D alinhados ao grid
Para que eu possa iterar a composicao visual do stage sem duplicacao acidental nem desalinhamento

### P3. Exportar um stage compativel com o runtime

Como administrador
Quero baixar um arquivo JSON compatível com o contrato atual do servidor
Para que eu possa levar o stage para a pipeline autoral sem retrabalho

## Requisitos

- `REQ-MBP-001` WHEN um administrador acessar `/admin/builder` THEN o sistema SHALL abrir uma rota administrativa dedicada dentro do shell atual e SHALL preservar a disponibilidade de `/admin/mapas`.
- `REQ-MBP-002` WHEN a rota do builder for inicializada THEN o sistema SHALL criar uma sessao de edicao com `mapInfo`, `placedItems` e `editorState` em estado global compartilhado.
- `REQ-MBP-003` WHEN o administrador alterar nome, tamanho do grid ou `defaultY` THEN o sistema SHALL persistir esses valores no estado do editor e SHALL disponibiliza-los imediatamente para viewport e exportacao.
- `REQ-MBP-004` WHEN o administrador acionar a geracao procedural com um `seed` THEN o sistema SHALL produzir uma base deterministica para a mesma combinacao de `seed` e `size` e SHALL refletir essa base no preview e no payload de exportacao.
- `REQ-MBP-005` WHEN a shelf de assets for exibida THEN o sistema SHALL listar um catalogo inicial de assets placeable mapeados para `prefabId` suportados pelo servidor e SHALL mostrar rotulos amigaveis ao operador.
- `REQ-MBP-006` WHEN o administrador selecionar um asset da shelf THEN o sistema SHALL atualizar `editorState.selectedAssetType` com a chave ativa e SHALL manter essa selecao ate nova troca ou limpeza explicita.
- `REQ-MBP-007` WHEN a ferramenta ativa for `paint` e existir um asset valido selecionado THEN um `pointerDown` sobre o grid SHALL iniciar um gesto de pintura e SHALL quantizar `x` e `z` para inteiros por arredondamento.
- `REQ-MBP-008` WHEN um gesto de pintura estiver ativo e o ponteiro permanecer sobre a mesma celula THEN o sistema SHALL nao criar itens adicionais para a mesma chave `x,y,z` durante esse gesto.
- `REQ-MBP-009` WHEN um gesto de pintura atravessar novas celulas THEN o sistema SHALL tentar no maximo uma colocacao por nova chave `x,y,z` visitada e SHALL ignorar chaves ja ocupadas.
- `REQ-MBP-010` WHEN um item for colocado THEN o sistema SHALL persistir ao menos `id`, `prefabId`, `x`, `y`, `z`, `rotationY`, `scale` e `meta` no estado do editor.
- `REQ-MBP-011` WHEN a ferramenta ativa for `delete` e o administrador clicar em um item colocado THEN o handler do item SHALL interromper a propagacao do evento e SHALL remover apenas o item alvo.
- `REQ-MBP-012` WHEN um item selecionado tiver seus dados alterados THEN o sistema SHALL atualizar o item por `id` e SHALL refletir rotacao, escala ou metadados atualizados no viewport e no export.
- `REQ-MBP-013` WHEN `placedItems` mudar THEN o renderer SHALL exibir todos os itens com transform derivado do estado e SHALL usar modelos carregados a partir do catalogo escolhido.
- `REQ-MBP-014` WHEN o administrador clicar em `Exportar stage` THEN o sistema SHALL baixar um arquivo compatível com o contrato atual de stage do servidor.
- `REQ-MBP-015` WHEN um stage for exportado THEN o arquivo SHALL conter `stageId`, `displayName`, `tiles` derivados da base procedural e `props` derivados de `placedItems`.
- `REQ-MBP-016` WHEN um prop for exportado THEN cada entrada SHALL incluir `id`, `prefabId`, `x`, `y`, `z`, `scale`, `yaw` e campos opcionais coerentes com o contrato atual do servidor.
- `REQ-MBP-017` WHEN o tamanho do mapa for alterado THEN o grid visual, a area de pintura e o payload exportado SHALL refletir a nova dimensao `n x n`.
- `REQ-MBP-018` WHEN a ferramenta `paint` estiver ativa sem asset valido selecionado THEN o sistema SHALL nao criar itens e SHALL comunicar que falta uma selecao ativa.
- `REQ-MBP-019` WHEN multiplos itens ocuparem a mesma coluna `x,z` com alturas diferentes THEN o sistema SHALL permitir a coexistencia desses itens desde que a chave `x,y,z` seja unica.
- `REQ-MBP-020` WHEN o arquivo exportado for produzido THEN ele SHALL ser suficiente para alimentar a pipeline atual de stages sem traducao manual de `type` simplificado para `prefabId`.

## Criterios de Aceitacao

- `AC-MBP-001` WHEN o admin navegar para `/admin/builder` THEN a rota SHALL abrir dentro do layout administrativo existente e `/admin/mapas` SHALL continuar acessivel.
- `AC-MBP-002` WHEN o admin gerar duas vezes a base com o mesmo `seed` e o mesmo `size` THEN o conjunto exportado de `tiles` SHALL permanecer identico.
- `AC-MBP-003` WHEN o admin segurar o ponteiro parado sobre a mesma celula com a ferramenta `paint` ativa THEN apenas um item SHALL existir naquela chave `x,y,z`.
- `AC-MBP-004` WHEN o admin arrastar a pintura por tres celulas livres distintas THEN tres itens SHALL ser criados, um por celula visitada.
- `AC-MBP-005` WHEN o admin clicar em um item com a ferramenta `delete` THEN o item SHALL desaparecer e nenhum novo item SHALL ser criado no plano base pelo mesmo clique.
- `AC-MBP-006` WHEN o admin colocar dois itens na mesma coluna com `y` diferente THEN ambos SHALL permanecer no estado e na exportacao.
- `AC-MBP-007` WHEN o admin exportar um stage valido THEN o JSON SHALL conter `stageId`, `displayName`, `tiles` e `props[]` com `prefabId`.
- `AC-MBP-008` WHEN um prop exportado usar um asset da shelf THEN seu identificador SHALL corresponder a um `prefabId` suportado pelo servidor atual.
- `AC-MBP-009` WHEN o tamanho do mapa for aumentado ou reduzido THEN o grid visivel e os limites exportados SHALL refletir a nova configuracao.
- `AC-MBP-010` WHEN nenhum asset estiver selecionado THEN a ferramenta `paint` SHALL permanecer inofensiva e SHALL orientar o operador a selecionar um asset.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-MBP-001` | P1 | rota dedicada entra no admin sem substituir a atual |
| `REQ-MBP-002` | P1 | sessao de edicao nasce com estado centralizado |
| `REQ-MBP-003` | P1 | metadados do mapa governam preview e exportacao |
| `REQ-MBP-004` | P1 | base procedural e deterministica |
| `REQ-MBP-005` | P1, P2 | catalogo da UI fica alinhado ao backend |
| `REQ-MBP-006` | P2 | selecao de asset fica explicita e persistente |
| `REQ-MBP-007` | P2 | pintura usa snapping de grid |
| `REQ-MBP-008` | P2 | ponteiro parado nao gera spam de itens |
| `REQ-MBP-009` | P2 | arraste pinta apenas celulas novas e livres |
| `REQ-MBP-010` | P2 | item colocado possui dados suficientes para editar e exportar |
| `REQ-MBP-011` | P2 | delete nao sofre click-through |
| `REQ-MBP-012` | P2 | itens podem ser atualizados por `id` |
| `REQ-MBP-013` | P2 | viewport reflete fielmente o estado |
| `REQ-MBP-014` | P3 | exportacao baixa arquivo utilizavel |
| `REQ-MBP-015` | P3 | stage exportado respeita container atual |
| `REQ-MBP-016` | P3 | props exportados ficam compativeis com o parser |
| `REQ-MBP-017` | P1, P3 | dimensao do mapa governa grid e exportacao |
| `REQ-MBP-018` | P2 | pintura sem asset nao muta estado |
| `REQ-MBP-019` | P2 | empilhamento vertical e permitido |
| `REQ-MBP-020` | P3 | pipeline atual nao exige traducao manual |

## Assuncoes

- A V1 do builder exporta para o contrato atual do servidor, nao para um formato alternativo simplificado.
- A shelf pode usar nomes amigaveis na UI, mas a exportacao usa `prefabId` suportado pelo backend.
- A edicao de rotacao, escala e `meta` pode nascer com controles simples de formulario, sem gizmo 3D nesta fase.
- A base procedural da V1 alimenta `tiles`; os objetos pintados alimentam `props`.
- `meta` pode existir no estado do editor sem necessariamente ser serializado no payload da V1 enquanto o contrato do servidor nao suportar esse campo.