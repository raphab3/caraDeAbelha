# Map Builder Pro Upgrade

Status: approved
Feature: map-builder-pro-upgrade
Source: extensao aprovada em chat em 2026-04-24

## Objetivo

Formalizar a segunda iteracao do Map Builder Pro, simplificando os controles de autoria, melhorando o snapping visual, reduzindo ruido de interface e tornando selecao, copia, colagem e feedback visual mais previsiveis para operacao intensa no editor.

## Relacao com a feature original

- Esta spec complementa [../map-builder-pro/spec.md](../map-builder-pro/spec.md).
- A feature original continua valida como baseline funcional da V1.
- Esta iteracao redefine interacoes de mouse, atalhos, selecao, biblioteca e marcacoes visuais sem reabrir o contrato de exportacao da V1.

## Problema

O builder atual ja permite gerar base, pintar e exportar, mas o modelo de interacao ainda mistura navegacao, pintura e selecao de forma pouco previsivel. A toolbar expõe acoes redundantes, a biblioteca apresenta assets que nao entregam valor real, a leitura de selecao ainda e fraca, e o snapping visual nao comunica bem o centro da celula como unidade de autoria.

## Usuario

Administrador ou operador interno responsavel por montar e revisar stages com alta frequencia dentro do editor visual.

## Dor

- O mouse ainda nao segue um contrato simples e memorizavel entre navegar, pintar e selecionar.
- A toolbar mostra opcoes demais para um fluxo que precisa ser rapido.
- O placement ainda e percebido como encaixe na intersecao do grid, e nao no quadrado de destino.
- O estado selecionado nao se destaca o suficiente durante edicao intensa.
- A biblioteca expõe itens ou categorias que nao agregam ao fluxo atual, inclusive itens nao funcionais.
- Os paines laterais ainda dependem de rolagem visivel, o que empobrece a leitura operacional da tela.

## Metas

- Tornar o contrato de mouse mais previsivel: botao direito para camera, botao esquerdo para acao.
- Reduzir a toolbar a um conjunto minimo de ferramentas visiveis.
- Introduzir selecao em massa por teclado com copia, colagem e remocao em lote.
- Fazer o snapping comunicar centro de celula em vez de cruzamento de linhas.
- Melhorar o feedback visual de selecao com destaque azul.
- Limpar a biblioteca removendo assets desnecessarios e exigindo funcionamento coerente dos itens restantes.
- Remover scrolls visiveis dos componentes operacionais principais.

## Restricoes

- O upgrade SHALL preservar a rota `/admin/builder` existente e o contrato de exportacao vigente.
- O upgrade SHALL evoluir a implementacao existente em `client/src/components/MapBuilder/` sem criar uma ferramenta paralela.
- O viewport 3D SHALL continuar usando `@react-three/fiber` e `@react-three/drei`.
- O estado global SHALL continuar centralizado em Zustand.
- A nova UX SHALL manter o cursor nativo do sistema e nao depender de cursores customizados para indicar modo.
- A iteracao SHALL manter o grid como referencia de autoria por celula.

## Fora de Escopo

- Undo/redo.
- Edicao colaborativa.
- Novo formato de exportacao.
- Upload de assets arbitrarios.
- Refactor amplo do pipeline de stages do backend.
- Gizmos 3D avancados de manipulacao.

## Criterios de Sucesso

- O operador consegue navegar o mapa sem acionar pintura ou delete por engano com o botao direito.
- O operador consegue pintar ou deletar com o botao esquerdo de forma consistente com a ferramenta ativa.
- O operador consegue entrar em modo de selecao por `Space`, selecionar varios itens e operar em lote.
- O operador percebe claramente que o item e colocado no centro do quadrado alvo.
- Itens selecionados ficam visualmente destacados em azul, com leitura superior ao estado atual.
- A biblioteca deixa de exibir o item `Beiral de Penhasco` e os itens restantes seguem um fluxo funcional coerente.
- Biblioteca e painel de detalhes nao exibem barras de rolagem visiveis nos layouts suportados.

## Historias

### P1. Operar com um modelo de controle previsivel

Como administrador
Quero que cada botao do mouse tenha uma funcao unica e previsivel
Para que eu possa navegar e editar o mapa sem cliques acidentais

### P2. Selecionar e operar em lote

Como administrador
Quero selecionar varios itens, copiar, colar, mover e deletar em massa
Para que eu possa editar partes maiores do mapa com mais velocidade

### P3. Ler melhor o grid, a selecao e a biblioteca

Como administrador
Quero feedback visual mais claro e uma biblioteca mais enxuta
Para que eu consiga decidir e posicionar elementos com menos ambiguidade

## Requisitos

- `REQ-MBPU-001` WHEN o usuario interagir com o viewport THEN o botao direito do mouse SHALL ser usado exclusivamente para rotacionar a camera e SHALL nunca pintar, deletar, selecionar ou mover itens.
- `REQ-MBPU-002` WHEN o usuario interagir com o viewport THEN o botao esquerdo do mouse SHALL executar apenas a acao da ferramenta ou modo ativo no contexto atual.
- `REQ-MBPU-003` WHEN a toolbar principal for exibida THEN o sistema SHALL mostrar apenas `Pintar` e `Deletar` como ferramentas visiveis de troca rapida.
- `REQ-MBPU-004` WHEN o usuario pressionar `Space` THEN o sistema SHALL entrar em modo de selecao e SHALL permitir selecionar itens para operacoes de lote.
- `REQ-MBPU-005` WHEN o modo de selecao estiver ativo THEN o sistema SHALL suportar selecao multipla persistida no estado do editor, e nao apenas selecao de item unico.
- `REQ-MBPU-006` WHEN existir uma selecao multipla ativa THEN o sistema SHALL permitir mover ou deletar o conjunto selecionado preservando os offsets relativos durante movimentacao em grupo.
- `REQ-MBPU-007` WHEN o usuario pressionar `Ctrl+C` THEN o sistema SHALL copiar o conjunto selecionado atual; WHEN o usuario pressionar `Ctrl+V` THEN o sistema SHALL colar esse conjunto preservando offsets relativos, rotacao, escala e metadados suportados.
- `REQ-MBPU-008` WHEN o usuario pressionar as setas do teclado THEN o sistema SHALL deslocar a navegacao pelo mapa sem mutar o stage nem alterar a ferramenta ativa.
- `REQ-MBPU-009` WHEN o usuario pressionar `Ctrl+/` THEN o sistema SHALL ocultar biblioteca, header, toolbar e painel de detalhes, mas SHALL manter um unico icone clicavel no topo direito para restaurar a UI.
- `REQ-MBPU-010` WHEN o builder renderizar o viewport THEN o sistema SHALL manter o cursor nativo do sistema e SHALL nao aplicar cursores especiais por modo de interacao.
- `REQ-MBPU-011` WHEN um item, terreno ou preview for alinhado ao grid THEN o snapping SHALL usar o centro da celula como unidade visual de autoria, e nao a intersecao das linhas.
- `REQ-MBPU-012` WHEN um item estiver selecionado THEN o sistema SHALL exibir uma marcacao visual azul de alto contraste para indicar selecao ativa.
- `REQ-MBPU-013` WHEN um item estiver em hover ou em contexto de delete THEN o sistema SHALL diferenciar visualmente esses estados do estado selecionado azul.
- `REQ-MBPU-014` WHEN a biblioteca de assets for exibida THEN o item `terrain/overhang-edge` SHALL deixar de ser oferecido ao operador.
- `REQ-MBPU-015` WHEN a biblioteca exibir a rampa principal THEN a rampa SHALL ser distinguivel visualmente de um bloco alto comum e SHALL representar uma transicao usavel para subida entre niveis.
- `REQ-MBPU-016` WHEN o usuario selecionar qualquer item remanescente da biblioteca THEN o item SHALL suportar o fluxo completo de preview, placement, selecao, copia, colagem, delecao e exportacao, de forma coerente com sua categoria.
- `REQ-MBPU-017` WHEN os componentes `Biblioteca` e `Detalhes` forem renderizados THEN eles SHALL evitar barras de rolagem visiveis nos breakpoints suportados, redistribuindo conteudo ou reduzindo densidade quando necessario.

## Criterios de Aceitacao

- `AC-MBPU-001` WHEN o usuario clicar com o botao direito e arrastar sobre o canvas THEN a camera SHALL rotacionar e nenhum item SHALL ser criado, removido, selecionado ou movido.
- `AC-MBPU-002` WHEN a ferramenta ativa for `Pintar` ou `Deletar` THEN apenas o botao esquerdo SHALL mutar o stage.
- `AC-MBPU-003` WHEN a toolbar for exibida THEN apenas `Pintar` e `Deletar` SHALL aparecer como ferramentas visiveis.
- `AC-MBPU-004` WHEN o usuario pressionar `Space` THEN o builder SHALL entrar em modo de selecao sem exigir clique adicional em um botao da toolbar.
- `AC-MBPU-005` WHEN o usuario selecionar varios itens e mover o conjunto THEN os itens SHALL preservar a formacao relativa entre si.
- `AC-MBPU-006` WHEN o usuario executar `Ctrl+C` seguido de `Ctrl+V` com uma selecao multipla ativa THEN o conjunto SHALL ser duplicado sem perder offsets internos.
- `AC-MBPU-007` WHEN o usuario usar as setas do teclado THEN a visao SHALL percorrer o mapa sem alterar o conteudo autorado.
- `AC-MBPU-008` WHEN o usuario usar `Ctrl+/` THEN toda a UI auxiliar SHALL desaparecer, mas o controle de restauracao SHALL continuar visivel no topo direito.
- `AC-MBPU-009` WHEN um item for posicionado THEN ele SHALL ocupar visualmente o centro do quadrado alvo do grid.
- `AC-MBPU-010` WHEN um item estiver selecionado THEN sua marcacao SHALL ser azul e visualmente distinta do hover e do delete.
- `AC-MBPU-011` WHEN a biblioteca for aberta THEN `Beiral de Penhasco` SHALL nao aparecer como opcao disponivel.
- `AC-MBPU-012` WHEN a rampa for usada entre dois niveis de terreno THEN ela SHALL ser reconhecivel como passagem de subida, e nao apenas como variacao cosmetica de bloco.
- `AC-MBPU-013` WHEN um item remanescente da biblioteca for escolhido THEN ele SHALL funcionar do placement ate a exportacao sem quebrar o fluxo do editor.
- `AC-MBPU-014` WHEN o builder for usado nos breakpoints suportados THEN `Biblioteca` e `Detalhes` SHALL nao exibir scrollbars nativas visiveis.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-MBPU-001` | P1 | botao direito vira controle exclusivo de camera |
| `REQ-MBPU-002` | P1 | botao esquerdo executa apenas a acao ativa |
| `REQ-MBPU-003` | P1 | toolbar fica reduzida ao minimo operacional |
| `REQ-MBPU-004` | P2 | `Space` entra em modo de selecao |
| `REQ-MBPU-005` | P2 | selecao multipla vira capacidade nativa do editor |
| `REQ-MBPU-006` | P2 | conjunto selecionado pode mover e deletar em lote |
| `REQ-MBPU-007` | P2 | copiar e colar passam a respeitar selecao multipla |
| `REQ-MBPU-008` | P1 | setas navegam pelo mapa sem editar conteudo |
| `REQ-MBPU-009` | P1 | `Ctrl+/` limpa a interface sem perder restauracao |
| `REQ-MBPU-010` | P1 | cursor nativo permanece como padrao |
| `REQ-MBPU-011` | P3 | snapping comunica centro de celula |
| `REQ-MBPU-012` | P3 | item selecionado ganha destaque azul |
| `REQ-MBPU-013` | P3 | estados visuais deixam de conflitar |
| `REQ-MBPU-014` | P3 | biblioteca remove item sem valor desejado |
| `REQ-MBPU-015` | P3 | rampa passa a comunicar subida funcional |
| `REQ-MBPU-016` | P3 | biblioteca remanescente precisa funcionar ponta a ponta |
| `REQ-MBPU-017` | P3 | paines eliminam scrolls visiveis |

## Assuncoes

- O upgrade reutiliza a rota e o dominio existentes em vez de abrir um segundo builder.
- O modo de selecao introduzido por `Space` pode coexistir com a toolbar reduzida, desde que a entrada por teclado seja a via principal para operacoes em lote.
- O destaque azul de selecao substitui o halo ambar atual como estado primario de item selecionado.
- O snapping ao centro da celula deve seguir a convencao espacial do mundo atual, em que tiles representam area e nao cruzamento de linhas.
- O requisito da rampa funcional pode demandar detalhamento adicional em `design.md` para fechar semantica de runtime e exportacao, mas permanece como requisito valido de produto nesta spec.