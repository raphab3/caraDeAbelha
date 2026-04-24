---
applyTo: ".github/agents/**/*.agent.md"
description: "Padroniza os agentes do workspace para o workflow tlc-spec-driven e evita regressão para o pipeline legado de EPIC, CORE FLOW e TICKETS."
---

# Agentes deste workspace

Todos os agentes de workflow deste repositório devem usar o skill tlc-spec-driven como fonte canônica.

## Conjunto canônico

Os únicos agentes de workflow deste workspace são, nesta ordem:

- 01 Start Here - Spec Driver
- 02 Optional - Map Codebase
- 03 Required - Specify
- 04 Optional - Discuss
- 05 Optional - Design
- 06 Optional - Tasks
- 07 Required - Execute
- 08 Required - Validate
- 99 Shortcut - Quick Task

## Regras obrigatórias

1. Usar a matriz de complexidade do TLC para decidir quick mode versus fluxo completo.
2. Preferir artefatos em .specs/project, .specs/codebase, .specs/features e .specs/quick.
3. Não criar novos artefatos em plans para o workflow padrão.
4. Não manter aliases legados como agentes separados.
5. Design e Tasks são opcionais e devem ser pulados explicitamente quando a complexidade não justificar.
6. Toda fase deve dizer claramente qual é o próximo passo e por que.
7. Quando houver decisão técnica, seguir a cadeia: codebase -> docs -> Context7 -> web -> incerteza explícita.
8. Sempre que uma fase fizer perguntas ao usuário (incluindo Start Here e Specify), usar obrigatoriamente a tool `vscode/askQuestions`.
9. Quando as fases Design ou Tasks forem solicitadas/aprovadas, persistir os artefatos em arquivos `.md` em `.specs/features/<feature>/` (não apenas responder no chat).
10. O agente 01 Start Here - Spec Driver é apenas um roteador: não implementa, não executa tasks, não cria artefatos e sempre termina perguntando qual é o próximo passo do fluxo após entender e classificar o pedido.
11. Para frontend deste repositório, seguir a diretriz CSS atual: CSS Modules por componente para código novo ou refatorado, `client/src/styles.css` apenas para reset/tokens/globais inevitáveis, e evitar novas strings longas de Tailwind ou blocos globais específicos de componente.
12. Não introduzir CSS-in-JS com runtime, como `styled-components` ou `emotion`, sem decisão técnica registrada em spec/design, porque a aplicação já possui custo relevante de renderização 3D.

## Fases preferenciais

- 01 Start Here - Spec Driver: sempre comece aqui para entender se todos os passos serão necessários, recomendar a próxima fase e pedir confirmação do próximo passo ao usuário.
- 02 Optional - Map Codebase: use apenas em brownfield quando o contexto do repositório estiver fraco.
- 03 Required - Specify: obrigatório para definir a spec.
- 04 Optional - Discuss: use só se houver ambiguidade material.
- 05 Optional - Design: use só quando houver decisão arquitetural real.
- 06 Optional - Tasks: use só quando Execute não couber em poucos passos óbvios.
- 07 Required - Execute: obrigatório para implementar.
- 08 Required - Validate: obrigatório para provar que funcionou.
- 99 Shortcut - Quick Task: atalho alternativo para mudanças pequenas, em vez do fluxo completo.
