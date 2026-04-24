# CSS Componentization Roadmap

Status: draft
Feature: css-componentization-roadmap
Source: solicitacao em chat em 2026-04-23

## Objetivo

Definir um roadmap para migrar a camada de estilos do frontend para CSS componentizado, reduzindo a complexidade de manutencao causada por `client/src/styles.css` global e por strings longas de classes em JSX.

## Problema

O frontend acumulou dois padroes que dificultam alterar um componente especifico com seguranca:

- estilos globais concentrados em `client/src/styles.css`, hoje com mais de 1400 linhas;
- componentes com `className` extensos e agregando layout, tema, estado, responsividade e interacao no JSX.

Esse modelo aumenta o custo de evolucao visual porque a pessoa desenvolvedora precisa descobrir se o estilo de uma tela esta no CSS global, no JSX, em regras descendentes, em modificadores BEM ou em utilitarios Tailwind.

## Usuario

Pessoa desenvolvedora ou agente de codigo trabalhando em UI do Cara de Abelha.

## Dor

Alterar um componente visual especifico exige procurar estilos espalhados e aumenta o risco de regressao em outras telas, especialmente em HUD, login, minimap, admin e Map Builder.

## Metas

- Estabelecer CSS Modules por componente como padrao para codigo novo e refatorado.
- Reduzir gradualmente a dependencia de `client/src/styles.css` para estilos de componente.
- Manter tokens globais para identidade visual, acessibilidade e consistencia.
- Preservar performance: zero runtime de CSS, sem adotar CSS-in-JS por padrao.
- Criar um plano incremental que possa ser executado sem reescrever toda a UI de uma vez.
- Garantir que build, typecheck e comportamento visual principal continuem funcionando a cada fatia.

## Restricoes

- A migracao SHALL ser incremental.
- A migracao SHALL preservar React + Vite + TypeScript.
- A migracao SHALL usar CSS Modules nativos do Vite para componentes novos ou refatorados.
- `client/src/styles.css` SHALL continuar existindo para `@import "tailwindcss"`, reset/base, tokens, cursores globais e regras transversais inevitaveis.
- Tailwind SHALL continuar disponivel, mas nao SHALL ser o mecanismo principal para componentes complexos.
- A migracao SHALL evitar CSS-in-JS com runtime, salvo decisao tecnica futura registrada.
- Componentes R3F/Three.js SHALL ser migrados apenas quando envolverem DOM/overlay; geometrias e materiais 3D nao entram no escopo de CSS Modules.

## Fora de Escopo

- Redesenhar a identidade visual do jogo.
- Trocar Tailwind por outra ferramenta de build.
- Introduzir shadcn/ui, Radix ou design system completo nesta fase.
- Reescrever componentes de gameplay ou WebSocket.
- Migrar estilos de modelos 3D, materiais Three.js ou shaders.
- Resolver todos os problemas de copy, responsividade ou acessibilidade fora dos componentes tocados.

## Criterios de Sucesso

- O projeto tem uma diretriz documentada de CSS componentizado no README e nas instrucoes de agentes.
- Existe uma estrutura recomendada de tokens e CSS Modules.
- Novos componentes deixam de adicionar estilos especificos em `client/src/styles.css`.
- Pelo menos um piloto migra componentes representativos sem regressao de build.
- O roadmap define ordem, dependencias, validacao e riscos por area.
- A cada fatia migrada, `npm run typecheck` e `npm run build` passam.

## Mapeamento atual

### CSS global

- `client/src/styles.css` concentra estilos globais, layout da experiencia do jogador, login, PWA prompt, fullscreen, settings, viewport, MiniMap, nameplates, foco de flor, modais e status.
- `client/src/components/MapGenerator/styles.css` e um CSS local comum, mas ainda nao usa CSS Modules.

### JSX com classes agregadas

- Componentes recentes de admin e Map Builder usam muitas classes Tailwind diretamente no JSX.
- HUD e paineis de status tambem misturam regra visual, estado e responsividade dentro de `className`.
- O padrao atual dificulta identificar se uma mudanca deve acontecer no componente, no global ou em ambos.

### Areas de maior risco

- Gameplay fullscreen: depende de `pointer-events`, `z-index`, cursores e altura do canvas.
- MiniMap: possui muitos modificadores e estados visuais.
- HUD: combina overlays, feedback temporario, barras de progresso e estados de coleta.
- Map Builder: tem canvas, shelf, inspector e header com layout denso.

## Roadmap macro

### Fase 1 - Fundacao

Criar tokens, padrao de CSS Modules e um piloto pequeno. Esta fase reduz risco antes de escalar.

Estimativa: 1 a 2 dias.

### Fase 2 - Gameplay surface

Migrar HUD, login, modais, settings e overlays do GameViewport. Esta fase ataca a maior dor do CSS global.

Estimativa: 3 a 5 dias.

### Fase 3 - Ferramentas internas

Migrar Admin, Map Builder e Map Generator. Esta fase reduz strings longas de Tailwind e deixa ferramentas de producao mais sustentaveis.

Estimativa: 4 a 7 dias.

### Fase 4 - Limpeza e guardrails

Enxugar `styles.css`, remover classes orfas, documentar exemplos e consolidar criterios de review.

Estimativa: 1 a 2 dias.

### Custo total esperado

O custo realista para uma migracao ampla e segura e de 1.5 a 2 semanas de trabalho. Um ganho relevante pode ser entregue em aproximadamente 1 semana se o escopo inicial focar nos componentes mais problemáticos.

## Historias

### P1. Padrao para codigo novo

Como pessoa desenvolvedora
Quero uma regra clara de onde colocar estilos novos
Para nao aumentar o CSS global nem strings longas de classes em JSX.

### P2. Migracao incremental

Como mantenedor do frontend
Quero migrar componentes por area e com verificacao por fatia
Para reduzir risco e manter o jogo funcional durante a transicao.

### P3. Tokens e consistencia visual

Como responsavel pela evolucao de UI
Quero tokens globais reutilizaveis por CSS Modules
Para manter consistencia sem acoplar componentes ao mesmo arquivo global.

## Requisitos

- `REQ-CSS-001` WHEN um componente novo tiver estilo visual relevante THEN ele SHALL criar ou usar um `*.module.css` local ao componente.
- `REQ-CSS-002` WHEN um componente existente for refatorado visualmente THEN estilos especificos dele SHALL migrar para CSS Module local, exceto globais inevitaveis.
- `REQ-CSS-003` WHEN um estilo for compartilhado por varias areas THEN ele SHALL ser representado por token global ou primitivo compartilhado, nao por seletor global acoplado a um componente.
- `REQ-CSS-004` WHEN `client/src/styles.css` for alterado THEN a mudanca SHALL ser limitada a reset/base, tokens, cursores, imports ou regras transversais justificadas.
- `REQ-CSS-005` WHEN uma classe local precisar representar estado visual THEN o componente SHALL expor props ou estado interno que mapeiem para classes do CSS Module.
- `REQ-CSS-006` WHEN uma string Tailwind em JSX acumular layout, visual, responsividade e estados THEN ela SHOULD ser extraida para CSS Module.
- `REQ-CSS-007` WHEN uma area for migrada THEN `npm run typecheck` e `npm run build` SHALL passar antes da task ser considerada concluida.
- `REQ-CSS-008` WHEN um componente migrado tiver estados interativos THEN foco visivel, alvo minimo de toque e estados disabled/loading SHALL ser preservados.
- `REQ-CSS-009` WHEN tokens forem criados THEN eles SHALL cobrir pelo menos cores, radius, sombras, z-index e motion usados por mais de uma area.
- `REQ-CSS-010` WHEN a migracao tocar HUD ou overlays de gameplay THEN ela SHALL preservar z-index, pointer-events e comportamento fullscreen.
- `REQ-CSS-011` WHEN a migracao tocar admin ou Map Builder THEN ela SHALL preservar responsividade, layout de workbench e controles de toque.
- `REQ-CSS-012` WHEN uma biblioteca CSS-in-JS for considerada THEN a decisao SHALL registrar custo de bundle/runtime e alternativa CSS Modules antes de aprovar.

## Criterios de Aceitacao

- `AC-CSS-001` Dado um novo componente visual, quando ele for implementado, entao seus estilos especificos ficam em `*.module.css`.
- `AC-CSS-002` Dado `client/src/styles.css`, quando uma nova feature for adicionada, entao o arquivo nao recebe blocos especificos de componente.
- `AC-CSS-003` Dado um componente migrado, quando o build rodar, entao `npm run typecheck` e `npm run build` passam.
- `AC-CSS-004` Dado um componente com variantes, quando a variante mudar, entao a mudanca acontece por props/classes locais e nao por concatenacao extensa no JSX.
- `AC-CSS-005` Dado o HUD ou uma overlay em fullscreen, quando migrados, entao `pointer-events`, empilhamento visual e foco continuam equivalentes.
- `AC-CSS-006` Dado o Map Builder ou admin, quando migrados, entao o canvas/layout principal continua utilizavel em desktop e mobile.
- `AC-CSS-007` Dado tokens compartilhados, quando usados em modulos diferentes, entao a identidade visual fica centralizada sem seletor global de componente.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-CSS-001` | P1 | padrao local para estilos novos |
| `REQ-CSS-002` | P2 | refactors reduzem acoplamento global |
| `REQ-CSS-003` | P3 | compartilhamento via tokens/primitivos |
| `REQ-CSS-004` | P1 | `styles.css` para de crescer com componentes |
| `REQ-CSS-005` | P1, P2 | variantes ficam explicitas no componente |
| `REQ-CSS-006` | P1, P2 | JSX fica mais legivel |
| `REQ-CSS-007` | P2 | cada fatia tem validacao objetiva |
| `REQ-CSS-008` | P2 | acessibilidade basica preservada |
| `REQ-CSS-009` | P3 | base visual compartilhada |
| `REQ-CSS-010` | P2 | gameplay nao regride |
| `REQ-CSS-011` | P2 | admin e builder nao regridem |
| `REQ-CSS-012` | P3 | evita custo de runtime sem decisao |

## Assuncoes

- CSS Modules atendem melhor ao custo atual porque ja funcionam no Vite e nao adicionam runtime.
- Tailwind pode continuar no projeto durante a transicao, mas nao deve ser usado como substituto para componentizacao em componentes complexos.
- O primeiro ganho deve vir de componentes com maior dor de manutencao, nao de uma migracao mecanica arquivo por arquivo.
