# Skill Runtime Effects

Status: proposed
Feature: skill-runtime-effects
Source: pedido em chat em 2026-04-24 para evoluir skills compraveis em runtime jogavel com cooldown, feedback visual completo no slot e projecao/efeito da skill no mundo

## Objetivo

Transformar o sistema atual de compra, equip e acionamento de skills em uma camada jogavel completa, com comportamento autoritativo no servidor, cooldown real, feedback visual forte no HUD e manifestacao visivel da skill no mundo.

## Relacao com a base atual

- Esta spec evolui o catalogo atual de skills (`Impulso`, `Atirar Ferrão`, `Slime de Mel`, `Flor de Néctar`) ja presente no backend e no client.
- O contrato `use_skill` ja existe, mas hoje apenas valida slot ocupado e devolve `interaction_result` com sucesso/falha nominal.
- O HUD atual ja possui 4 slots, atalhos numericos, loadout editavel e um feed de interacao.
- Esta iteracao adiciona tempo de recarga, estados visuais no slot e runtime de efeitos no mundo sem quebrar o servidor como autoridade.

## Problema

Hoje o jogador consegue comprar skills, equipar nos 4 slots e acionar um slot, mas o acionamento ainda nao gera consequencia mecanica nem visual alem do texto no feed. Isso cria um sistema incompleto: o loadout existe, mas nao altera o jogo.

Sem cooldown, feedback de estado e manifestacao concreta da skill no mundo, o jogador nao entende quando a skill pode ser usada, o que ela fez, se acertou algo e qual e a diferenca entre as 4 skills.

## Usuario

Jogador controlando a abelha no loop principal do mundo em tempo real.

## Dor

- O clique no slot ou tecla de atalho nao produz efeito jogavel visivel.
- O jogador nao sabe se a skill esta pronta, em cooldown, bloqueada ou sem alvo valido.
- O slot ainda nao comunica o ciclo completo de uso: pronto, acionado, recarregando, pronto de novo.
- Skills ofensivas e utilitarias nao possuem projeção/entidade runtime no mundo, entao faltam leitura espacial e impacto.
- Sem um contrato formal, o time corre o risco de implementar efeitos pontuais desalinhados entre HUD, runtime e protocolo.

## Metas

- Introduzir cooldown autoritativo por slot/skill.
- Exibir feedback visual completo no slot: pronto, pressionado, ativo, recarregando, indisponivel e concluido.
- Introduzir projeção/manifestacao de skill no mundo com leitura espacial coerente para cada skill.
- Garantir que o cliente continue enviando intencao e o servidor siga decidindo validacao, spawn, duracao e resultado.
- Criar base extensivel para futuras skills sem reabrir arquitetura.

## Restricoes

- O servidor SHALL continuar autoritativo para uso de skill, cooldown, spawn de efeito, hit, area e expiracao.
- O cliente SHALL nao inventar acerto, dano, lentidao, cura ou reposicionamento final.
- Toda skill SHALL ter ao menos um estado visual no slot e um estado runtime no mundo quando acionada com sucesso.
- O cooldown SHALL sobreviver a latencia e convergir pelo estado autoritativo recebido do servidor.
- A V1 SHALL operar com os 4 slots atuais e atalhos numericos atuais.
- O feedback visual SHALL funcionar em desktop e mobile sem depender exclusivamente de hover.
- Os efeitos SHALL respeitar performance do loop atual e nao inflar snapshots globais desnecessariamente.

## Fora de Escopo

- Skill tree completa por pontos de skill.
- Sistema completo de combate PvE com vida, inimigos finais e boss AI complexa.
- Sinergias coop completas entre multiplos jogadores.
- Particulas cinematograficas pesadas ou pipeline de VFX fora da stack atual.
- Predicao client-side complexa de hit para mascarar latencia.

## Criterios de Sucesso

- O jogador percebe claramente quando uma skill esta pronta, foi acionada e quando podera ser usada de novo.
- Cada skill gera uma manifestaçao visivel no mundo coerente com sua fantasia.
- O servidor rejeita uso invalido e o HUD diferencia falha de cooldown, falha de alvo e slot vazio.
- O ciclo completo de uso fica legivel: input, confirmacao, efeito visual, cooldown, reativacao.
- O contrato final permite adicionar uma quinta skill futura sem reinventar o fluxo.

## Estado Atual

Catalogo vigente:

- `skill:impulso` — mobilidade — `40 mel`
- `skill:atirar-ferrao` — dano — `60 mel`
- `skill:slime-de-mel` — controle — `80 mel`
- `skill:flor-de-nectar` — suporte — `100 mel`

Contrato vigente:

- `buy_skill`
- `equip_skill`
- `use_skill`
- `player_status` com `ownedSkillIds`, `equippedSkills`, `skillCatalog`
- `interaction_result` para feedback textual

## Fantasia de Skill e Runtime Esperado

### S1. Impulso

Fantasia: arrancada curta para reposicionar a abelha rapidamente.

Resultado esperado:

- dash curto na direcao atual de movimento ou ultima direcao valida;
- rastro visual curto e brilhante;
- deslocamento autoritativo instantaneo ou quase instantaneo, com validacao de colisao e bounds;
- cooldown curto para uso frequente.

### S2. Atirar Ferrão

Fantasia: disparo ofensivo frontal e rapido.

Resultado esperado:

- projeção tipo projectile linear;
- travel visivel no mundo com direcao clara;
- base para hit futuro em inimigos e objetos interagiveis;
- cooldown medio.

### S3. Slime de Mel

Fantasia: poça viscosa de controle de area.

Resultado esperado:

- projeção no chao no ponto alvo ou a frente da abelha;
- duracao temporaria no mundo;
- area com leitura clara de raio e borda;
- prepara lentidao futura em inimigos/entidades validas;
- cooldown medio para alto.

### S4. Flor de Néctar

Fantasia: broto de suporte que cria area de néctar.

Resultado esperado:

- projeção fixa no mundo com crescimento curto;
- aura de suporte com leitura radial;
- base para cura/regeneracao futura do proprio jogador e aliados;
- cooldown mais alto e assinatura visual mais rica.

## Modelo Conceitual

### Runtime de skill

Cada uso bem-sucedido deve gerar uma entidade runtime ou efeito transiente descrito por um contrato comum.

```go
type activeSkillEffect struct {
  ID string
  OwnerPlayerID string
  SkillID string
  Slot int
  StageID string
  Kind string
  State string
  SpawnX float64
  SpawnY float64
  DirectionX float64
  DirectionY float64
  Radius float64
  Speed float64
  DurationMs int
  StartedAt time.Time
  ExpiresAt time.Time
}
```

Kinds minimos desta fase:

- `dash`
- `projectile`
- `ground-area`
- `support-area`

### Estado de slot no HUD

Cada slot deve expor estado derivado do runtime autoritativo:

- `ready`
- `casting`
- `active`
- `cooldown`
- `blocked`
- `empty`

## Historias

### P1. Entender disponibilidade da skill

Como jogador
Quero ver no slot quando a skill esta pronta ou recarregando
Para saber o melhor momento de usar

### P2. Ver a skill acontecer no mundo

Como jogador
Quero que cada skill tenha uma projeção ou efeito visivel
Para perceber alcance, direcao, area e impacto

### P3. Receber confirmacao coerente do uso

Como jogador
Quero feedback claro quando uma skill falha por cooldown, slot vazio ou alvo invalido
Para nao interpretar falha como lag ou bug

### P4. Construir base reutilizavel para novas skills

Como mantenedor
Quero um contrato runtime unificado para cooldown e efeitos
Para adicionar skills futuras sem quebrar o HUD nem o protocolo

## Requisitos

- `REQ-SRE-001` WHEN o jogador acionar `use_skill` THEN o servidor SHALL validar slot, skill equipada, cooldown atual e regras especificas da skill antes de aceitar o uso.
- `REQ-SRE-002` WHEN uma skill for aceita THEN o servidor SHALL registrar cooldown autoritativo para aquele slot ou skill antes de concluir a resposta ao cliente.
- `REQ-SRE-003` WHEN uma skill estiver em cooldown THEN o HUD SHALL exibir visual de recarga com progresso perceptivel e SHALL impedir leitura ambigua de slot pronto.
- `REQ-SRE-004` WHEN uma skill sair de cooldown THEN o slot SHALL retornar para estado `ready` com feedback visual claro, sem depender apenas do texto no feed.
- `REQ-SRE-005` WHEN o uso for rejeitado por cooldown THEN o cliente SHALL receber feedback distinguivel de slot vazio, skill invalida e alvo/regra invalida.
- `REQ-SRE-006` WHEN `Impulso` for usado com sucesso THEN o servidor SHALL aplicar reposicionamento curto autoritativo respeitando colisao, traversabilidade e bounds.
- `REQ-SRE-007` WHEN `Impulso` for aceito THEN o cliente SHALL renderizar rastro curto ou afterimage coerente com a arrancada.
- `REQ-SRE-008` WHEN `Atirar Ferrão` for usado com sucesso THEN o servidor SHALL criar uma projeção tipo projectile com origem, direcao, velocidade e tempo de vida definidos.
- `REQ-SRE-009` WHEN o projectile de `Atirar Ferrão` existir THEN o cliente SHALL renderizar travel visivel e SHALL removê-lo ao expirar ou colidir.
- `REQ-SRE-010` WHEN `Slime de Mel` for usado com sucesso THEN o servidor SHALL criar uma area temporaria no mundo com posicao, raio e duracao autoritativos.
- `REQ-SRE-011` WHEN a area de `Slime de Mel` estiver ativa THEN o cliente SHALL renderizar uma poça ou marca de chao com leitura de raio e tempo remanescente.
- `REQ-SRE-012` WHEN `Flor de Néctar` for usada com sucesso THEN o servidor SHALL criar uma area de suporte no mundo com spawn, crescimento inicial curto e duracao definida.
- `REQ-SRE-013` WHEN a area de `Flor de Néctar` estiver ativa THEN o cliente SHALL renderizar broto/aura radial distinguivel de `Slime de Mel`.
- `REQ-SRE-014` WHEN uma skill estiver em estado `casting`, `active` ou `cooldown` THEN o slot correspondente SHALL refletir esse estado com mudanca de cor, brilho, overlay ou contador.
- `REQ-SRE-015` WHEN o jogador pressionar o atalho ou clicar no slot THEN o slot SHALL exibir feedback de input imediato mesmo antes da confirmacao final, desde que o estado converja para a resposta do servidor.
- `REQ-SRE-016` WHEN o servidor publicar estado privado do jogador THEN ele SHALL incluir dados suficientes para cooldown do slot e estado de skill ativa sem inflar o snapshot publico de todos os jogadores.
- `REQ-SRE-017` WHEN o servidor publicar estado do mundo necessario para outras skills visiveis THEN ele SHALL transmitir apenas os efeitos ativos relevantes no stage/runtime atual.
- `REQ-SRE-018` WHEN um efeito de skill expirar THEN o servidor SHALL removê-lo do runtime e o cliente SHALL remover a representacao visual correspondente.
- `REQ-SRE-019` WHEN uma skill exigir direcao ou alvo THEN a primeira fase SHALL definir uma origem/direcao deterministica a partir da abelha e MAY evoluir depois para alvo por cursor.
- `REQ-SRE-020` WHEN o projeto introduzir combate, lentidao ou cura completos futuramente THEN os contratos desta fase SHALL poder carregar payload adicional sem romper o formato base de cooldown e efeito ativo.
- `REQ-SRE-021` WHEN uma skill for acionada repetidamente durante cooldown THEN o servidor SHALL rejeitar usos redundantes sem criar efeitos duplicados.
- `REQ-SRE-022` WHEN o jogador trocar de stage, desconectar ou morrer futuramente THEN qualquer efeito runtime de skill com posse local SHALL seguir a politica definida por skill e nao permanecer ativo de forma inconsistente.
- `REQ-SRE-023` WHEN a latencia atrasar a resposta autoritativa THEN o HUD SHALL convergir sem travar o slot indefinidamente em estado intermediario.
- `REQ-SRE-024` WHEN houver varias skills ativas no mundo THEN o sistema SHALL priorizar efeitos leves e renderizacao barata compativeis com o loop atual.

## Criterios de Aceitacao

- `AC-SRE-001` Dado um slot com skill pronta, quando o jogador clicar ou pressionar o atalho, entao o slot mostra feedback imediato e depois entra em cooldown apos confirmacao do servidor.
- `AC-SRE-002` Dado um slot em cooldown, quando o jogador tentar usar a skill novamente, entao nenhum efeito duplicado nasce e o feedback indica cooldown.
- `AC-SRE-003` Dado `Impulso` equipado, quando a skill e acionada com sucesso, entao a abelha realiza dash curto valido e um rastro visual aparece.
- `AC-SRE-004` Dado `Atirar Ferrão` equipado, quando a skill e acionada, entao um projectile visivel percorre o mundo e desaparece ao expirar ou colidir.
- `AC-SRE-005` Dado `Slime de Mel` equipado, quando a skill e acionada, entao uma poça aparece no mundo com raio legivel e desaparece apos a duracao prevista.
- `AC-SRE-006` Dado `Flor de Néctar` equipada, quando a skill e acionada, entao um broto/area de suporte aparece com leitura visual distinta da poça de slime.
- `AC-SRE-007` Dado um jogador com varias skills equipadas, quando cada slot estiver em estado diferente, entao o HUD diferencia claramente `ready`, `active`, `cooldown` e `empty`.
- `AC-SRE-008` Dado falha por slot vazio, quando `use_skill` for enviado, entao o feedback nao usa a mesma mensagem visual de cooldown.
- `AC-SRE-009` Dado um efeito ativo no mundo, quando ele expira, entao sua entidade some do runtime e da renderizacao do cliente.
- `AC-SRE-010` Dado um reconnect do jogador durante cooldown, quando o estado privado sincroniza, entao o slot converge para o tempo remanescente correto.

## UX do Slot

Estados minimos visuais por slot:

- `ready`: badge nítido, glow suave, ponto de status aceso.
- `pressed`: leve compressao/flash de input local.
- `active`: borda e brilho mais fortes enquanto a skill esta em execucao relevante.
- `cooldown`: overlay circular, sweep vertical ou mascara de recarga com contador numerico opcional.
- `blocked`: shake leve ou pulso de erro quando o uso falha por cooldown ou invalidez.
- `empty`: estado neutro sem confundir com cooldown.

Leituras obrigatorias:

- o jogador deve saber qual slot acabou de disparar;
- o jogador deve perceber o tempo de recarga remanescente;
- o jogador deve diferenciar skill ainda ativa no mundo versus skill apenas recarregando.

## Protocolo Proposto

### Estado privado do jogador

Adicionar ao `player_status` uma estrutura privada de runtime para slots:

```json
{
  "type": "player_status",
  "equippedSkills": ["skill:impulso", "skill:atirar-ferrao", "", ""],
  "skillRuntime": [
    {
      "slot": 0,
      "skillId": "skill:impulso",
      "state": "cooldown",
      "cooldownEndsAt": 1713991023456,
      "activeEffectId": "fx_123"
    }
  ]
}
```

### Estado de efeitos ativos do mundo

Opcao recomendada: mensagem dedicada em vez de inflar `state` inteiro.

```json
{
  "type": "skill_effects",
  "effects": [
    {
      "id": "fx_123",
      "ownerPlayerId": "player:rafa",
      "skillId": "skill:atirar-ferrao",
      "kind": "projectile",
      "state": "active",
      "x": 12.5,
      "y": 0.5,
      "dirX": 1,
      "dirY": 0,
      "radius": 0,
      "expiresAt": 1713991023456
    }
  ]
}
```

### Erro de uso de skill

Opcao recomendada: padronizar razoes de falha.

- `empty_slot`
- `cooldown_active`
- `invalid_skill`
- `invalid_direction`
- `invalid_target`
- `blocked_by_rules`

## Cooldown Proposto Inicial

Valores iniciais de produto para a primeira calibracao:

- `Impulso`: `1800ms`
- `Atirar Ferrão`: `2500ms`
- `Slime de Mel`: `6000ms`
- `Flor de Néctar`: `8000ms`

Observacao: valores sao seed de tuning, nao contrato imutavel.

## Runtime por Skill

### Impulso

- ativacao instantanea;
- deslocamento curto orientado pela ultima direcao valida;
- sem projectile persistente;
- efeito visual principal: trail/ghost e burst de saida;
- custo principal: validacao de dash e sincronizacao de posicao.

### Atirar Ferrão

- projectile linear leve;
- travel curto e rapido;
- preparado para colisao futura com inimigos, props sensiveis ou triggers;
- pode ser representado como pequeno ferrão brilhante com trail fino.

### Slime de Mel

- spawn de area no chao;
- duracao fixa;
- leitura de borda e miolo viscoso;
- preparado para aplicar slow futuro em entidades que entrarem no raio.

### Flor de Néctar

- spawn de area de suporte com broto crescendo;
- pulso de aura sutil;
- preparado para ticks futuros de cura/regeneracao.

## Arquitetura Recomendada

### Backend

Arquivos provaveis:

- `server/internal/httpserver/skills_runtime.go`
- `server/internal/httpserver/skills_cooldown.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/ws_messages.go`
- `server/internal/httpserver/stage_runtime.go` ou equivalente

Responsabilidades:

- validar uso de skill;
- iniciar cooldown;
- spawnar e avançar efeitos ativos;
- publicar estado privado do slot;
- publicar efeitos ativos no stage;
- expirar efeitos e limpar referencias.

### Frontend

Arquivos provaveis:

- `client/src/game/hud/SkillLoadoutBar.tsx`
- `client/src/game/hud/SkillLoadoutBar.module.css`
- `client/src/hooks/useGameSession.ts`
- `client/src/types/game.ts`
- `client/src/components/GameViewport/` ou `client/src/game/` para renderers de skill effects

Responsabilidades:

- reconciliar `skillRuntime` com slots;
- renderizar overlays de cooldown e feedback de input;
- renderizar entidades/areas de skill no mundo;
- limpar efeitos expirados;
- manter feedback consistente em reconnect e troca de estado.

## Performance

- efeitos ativos SHOULD usar payload leve e lista dedicada por stage;
- cooldown privado SHOULD trafegar no `player_status` e nao no snapshot publico;
- VFX SHOULD preferir geometrias simples, decals leves, sprites ou meshes reutilizaveis;
- areas temporarias SHOULD evitar alocacao excessiva por frame;
- projectiles SHOULD ter limite maximo simultaneo por jogador para evitar spam visual.

## Testes Esperados

### Backend

- uso aceito inicia cooldown;
- uso durante cooldown falha com razao correta;
- impulso respeita bounds e tiles bloqueados;
- projectile expira no tempo certo;
- area temporaria nasce e some no prazo;
- reconnect preserva cooldown remanescente.

### Frontend

- slot muda de `ready` para `cooldown` ao usar skill;
- slot nao fica preso em estado intermediario em caso de erro;
- overlay de cooldown volta a `ready` ao fim do tempo;
- renderers removem efeito expirado;
- tecla de atalho continua acionando o slot correto.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-SRE-001` | P1, P4 | uso segue autoritativo |
| `REQ-SRE-002` | P1 | cooldown nasce no servidor |
| `REQ-SRE-003` | P1 | HUD mostra recarga |
| `REQ-SRE-004` | P1 | HUD volta a pronto |
| `REQ-SRE-005` | P3 | falhas ficam claras |
| `REQ-SRE-006` | P2 | dash real de impulso |
| `REQ-SRE-007` | P2 | feedback visual do dash |
| `REQ-SRE-008` | P2 | projectile de ferrão |
| `REQ-SRE-009` | P2 | renderizacao do projectile |
| `REQ-SRE-010` | P2 | area de slime autoritativa |
| `REQ-SRE-011` | P2 | leitura visual do slime |
| `REQ-SRE-012` | P2 | area de nectar autoritativa |
| `REQ-SRE-013` | P2 | leitura visual do nectar |
| `REQ-SRE-014` | P1 | estados de slot completos |
| `REQ-SRE-015` | P1, P3 | feedback imediato de input |
| `REQ-SRE-016` | P1, P4 | estado privado suficiente |
| `REQ-SRE-017` | P2, P4 | efeitos publicos leves |
| `REQ-SRE-018` | P2 | expiracao consistente |
| `REQ-SRE-019` | P2 | direcao/alvo fechado na fase |
| `REQ-SRE-020` | P4 | extensibilidade futura |
| `REQ-SRE-021` | P3 | sem duplicacao por spam |
| `REQ-SRE-022` | P4 | limpeza consistente |
| `REQ-SRE-023` | P1, P3 | convergencia sob latencia |
| `REQ-SRE-024` | P4 | performance preservada |

## Assuncoes

- A primeira fase pode usar direcao derivada da orientacao/ultimo movimento da abelha em vez de mira livre no cursor.
- Dano, slow e cura completos podem entrar como aplicadores futuros, desde que a projeção e o ciclo de cooldown ja existam agora.
- `skill_effects` pode nascer como mensagem dedicada ou como extensao controlada de `state`, desde que o contrato preserve isolamento por stage.
- O feed textual atual continua util como camada complementar, mas deixa de ser a unica confirmacao de uso.
