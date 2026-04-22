# Task Guide: Cara de Abelha MMORPG Foundation

Status: active
Feature: Cara de Abelha MMORPG Foundation

## Objetivo

Este arquivo registra orientacoes operacionais para qualquer task desta feature, principalmente quando a implementacao precisar de materiais visuais, sons, sprites, modelos 3D ou placeholders de jogo.

## Regra geral

- sempre reutilizar assets existentes antes de criar ou importar material novo
- priorizar assets ja servidos pelo client em `client/public/kenney_platformer-kit`
- se um asset ainda nao estiver no `public` do client, a origem autorizada para copia e `materials/Starter-Kit-3D-Platformer-main`
- copiar apenas o necessario para a task atual; evitar despejar kits inteiros em `public`
- nao editar os arquivos do kit de origem dentro de `materials/Starter-Kit-3D-Platformer-main`; esse diretorio deve ser tratado como fonte
- quando copiar asset novo para o client, manter nome previsivel e documentar a decisao na task ou no epic correspondente

## Caminhos aprovados

### Assets prontos para uso no client

Use primeiro:

- `/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/client/public/kenney_platformer-kit`

Conteudo relevante ja disponivel:

- `Models/`
- `Previews/`
- `rpg-adventure.mp3`
- arquivos de preview e documentacao do kit

### Fonte autorizada para copiar novos assets para o client

Se precisar material que ainda nao esteja no `public`, copiar a partir de:

- `/home/raphab33/Documents/projetos/myProjects/CaraDeAbelha2/materials/Starter-Kit-3D-Platformer-main`

Conteudo relevante identificado:

- `models/` com `.glb` de plataformas, moeda, personagem, nuvem, flag e props do mundo
- `sounds/` com `.ogg` de `break`, `coin`, `fall`, `jump`, `land` e `walking`
- `sprites/` com `coin.png`, `particle.png`, `blob_shadow.png` e `skybox.png`
- `fonts/`, `objects/`, `scenes/` e outros artefatos do kit Godot como referencia adicional

## Como decidir o asset certo

### Para materiais de mundo e props 3D

- verificar primeiro se o asset ja existe em `client/public/kenney_platformer-kit/Models`
- se nao existir, procurar equivalente em `materials/Starter-Kit-3D-Platformer-main/models`
- priorizar props simples e legiveis para gameplay, nao modelos complexos que desviem o foco da iteracao atual

### Para sons

- usar `materials/Starter-Kit-3D-Platformer-main/sounds` como base para feedbacks de coleta, moeda, salto, impacto e movimento
- para tarefas de coleta e mel, os candidatos naturais sao `coin.ogg`, `break.ogg` e `walking.ogg`
- evitar adicionar audio novo sem antes verificar se um dos sons do kit cobre o caso

### Para sprites e feedback 2D

- usar `materials/Starter-Kit-3D-Platformer-main/sprites` para icones simples, particulas e apoio visual de HUD
- `coin.png` e `particle.png` sao os primeiros candidatos para feedbacks de recompensa e coleta
- qualquer sprite novo copiado para o client deve ficar em pasta previsivel dentro de `client/public`

## Regras de copia para `client/public`

- copiar apenas os arquivos usados pela feature atual
- preservar extensao original quando possivel
- manter os nomes em kebab-case ou no nome original do kit, sem renomeacoes arbitrarias
- se um asset vier de `materials/Starter-Kit-3D-Platformer-main`, preferir copiar para uma subpasta clara dentro de `client/public`, por exemplo:
  - `client/public/gameplay/models/`
  - `client/public/gameplay/sounds/`
  - `client/public/gameplay/sprites/`
- se a task estiver apenas validando um conceito, usar o menor conjunto de arquivos possivel

## Regras por tipo de task

### Tasks de loop base

- flores, colmeias, moeda, particulas curtas e feedbacks de coleta devem reaproveitar assets existentes antes de qualquer importacao nova
- para o primeiro slice, vale mais um feedback claro com assets do kit do que fidelidade visual alta

### Tasks de combate

- usar os modelos e sons do kit como placeholder de bestiario, impacto, hit e recompensa ate existir direcao artistica propria
- nao bloquear o combate por falta de arte final

### Tasks de HUD

- usar sprites apenas quando ajudarem leitura imediata de recurso, objetivo ou recompensa
- evitar excesso de icones e decoracao que transformem a HUD em painel administrativo

### Tasks de prototipo

- preferir placeholder funcional e consistente com o kit, sem investir em polish fora do escopo do epic

## Boas praticas de implementacao

- sempre registrar no `task.md` ou no PR interno quais assets novos foram copiados para o client
- se um asset novo entrar no fluxo, garantir que o caminho usado pelo frontend seja estavel e legivel
- validar que o asset carrega em dev e build antes de considerar a task concluida
- se houver duvida entre dois assets parecidos, escolher o mais simples e mais leve para a iteracao atual

## Checklist rapido para qualquer task que use assets

- [ ] verifiquei primeiro `client/public/kenney_platformer-kit`
- [ ] se precisei copiar, usei `materials/Starter-Kit-3D-Platformer-main` como origem
- [ ] copiei apenas o necessario para a task atual
- [ ] o asset foi colocado em pasta previsivel dentro de `client/public`
- [ ] documentei a decisao no `task.md` ou no epic correspondente
- [ ] validei carregamento local e build

## Observacao final

Este guia existe para acelerar execucao. Falta de arte final nao deve bloquear task de gameplay quando os kits acima ja oferecem material suficiente para prototipar com clareza.