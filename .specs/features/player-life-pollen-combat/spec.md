# Player Life, Pollen Energy and PvP Respawn

Status: proposed
Feature: player-life-pollen-combat
Source: pedido em chat em 2026-04-24 para introduzir life, energia baseada em polen, uso de skills entre jogadores, regeneracao automatica de life e respawn por morte

## Objetivo

Evoluir o loop atual de exploracao, coleta e skills para um loop completo de combate entre jogadores, no qual:

- cada jogador possui life visivel;
- skills consomem energia;
- a energia usa o conceito atual de polen carregado;
- skills podem afetar outros jogadores;
- life regenera automaticamente ao longo do tempo;
- ao zerar a life o jogador morre e renasce no respawn.

## Relacao com a base atual

- O servidor ja e autoritativo para movimento, coleta, deposito, progressao, compra/equip de skills e runtime basico de efeitos.
- O cliente ja recebe `player_status`, `state`, `interaction_result` e `skill_effects`.
- O jogo ja possui `pollenCarried`, `pollenCapacity` e `honey` como economia de coleta e compra.
- O jogo ja possui `use_skill` por slot e `respawn` manual.

Esta spec propoe reaproveitar essas fundacoes em vez de criar um sistema paralelo de combate fora do loop atual.

## Problema

Hoje o jogador consegue se mover, coletar polen, converter em mel, comprar skills, equipar e acionar efeitos. Porem o sistema ainda nao possui risco, perda, sobrevivencia nem impacto entre jogadores.

Sem life, energia de cast, dano entre jogadores e respawn por morte:

- skills ofensivas nao fecham o ciclo de combate;
- o HUD nao comunica sobrevivencia;
- o loop de progressao nao tem custo tatico durante o encontro entre jogadores;
- o `respawn` atual depende de acao manual em vez de estado de morte.

## Decisao Central

### D1. Polen carregado passa a ser a energia de skill

Recomendacao desta spec:

- manter `honey` como moeda de compra, upgrade e unlock;
- manter `pollenCarried` como recurso carregado no mundo;
- reinterpretar `pollenCarried` tambem como energia disponivel para cast;
- expor no HUD esse recurso com o nome composto `Energia (Pólen)` para o jogador entender que e o mesmo medidor.

Justificativa:

- reduz escopo, porque o servidor ja conhece `pollenCarried` e `pollenCapacity`;
- preserva a fantasia do jogo: flor gera polen, polen vira poder, colmeia converte em mel;
- cria uma troca tensa e legivel entre guardar polen para economia e gastar polen em combate.

Consequencia intencional:

- depositar polen na colmeia reduz a energia disponivel para skills;
- usar skills reduz o polen que poderia virar mel.

Observacao de produto:

- se esse acoplamento ficar punitivo demais, a fase futura pode separar `combatPollen` de `bankedPollen`; esta spec explicitamente NAO recomenda fazer essa separacao agora.

## Usuario

Jogador controlando sua abelha em um mundo multiplayer em tempo real, coletando polen, investindo em skills e encontrando outras abelhas no mapa.

## Dor

- nao existe barra de life para leitura de risco;
- nao existe custo de energia por cast;
- `Atirar Ferrão` e `Slime de Mel` ainda nao conseguem produzir consequencia sobre outros jogadores;
- flor de suporte ainda nao conversa com um sistema de cura real;
- `respawn` depende de input manual e nao de derrota.

## Metas

- introduzir `life` e `maxLife` como atributos autoritativos do jogador;
- introduzir gasto de energia por skill usando polen carregado;
- fazer skills afetarem outros jogadores com regras server-authoritative;
- adicionar regeneracao automatica de life com atraso apos dano;
- transformar morte em fluxo formal de combate com respawn automatico;
- adicionar HUD minimo para life e energia local, com leitura de life dos outros jogadores.

## Restricoes

- o servidor SHALL continuar sendo a unica fonte de verdade para dano, cura, gasto de energia, morte e respawn;
- o cliente SHALL continuar enviando intencao, nunca decidindo hit, dano ou morte localmente;
- a primeira fase SHALL reutilizar `pollenCarried` como energia, sem criar um segundo pool de energia;
- a primeira fase SHALL preservar `honey` como moeda separada;
- a primeira fase SHALL usar colisao espacial e areas autoritativas para acertar outros jogadores, sem precisar de lock-on obrigatorio;
- o sistema SHALL evitar spawn-kill em loop;
- a renderizacao SHALL continuar leve o bastante para o loop atual de R3F;
- o protocolo novo SHALL ser extensivel para PvE futuro sem quebra de contrato.

## Fora de Escopo

- matchmaking, times, faccoes ou regras formais de arena;
- persistencia longa de kill/death stats em banco;
- inventario de consumiveis de cura;
- reviver aliado, estado downed ou espectador;
- sistema completo de status negativos empilhaveis;
- balanceamento final de numeros.

## Criterios de Sucesso

- o jogador enxerga uma barra de life e um medidor de energia no HUD;
- usar skill consome polen e falha quando faltar energia;
- pelo menos uma skill ofensiva e uma skill de area conseguem afetar outros jogadores;
- life regenera sozinha fora da janela recente de dano;
- quando life zera, o jogador perde o controle momentaneamente, renasce no respawn e volta com estado limpo;
- o protocolo deixa claro o que e estado privado do jogador e o que e estado publico do combate.

## Visao de Produto

O loop desejado fica:

1. jogador coleta polen em flores;
2. esse polen serve tanto para futura conversao em mel quanto para energia de skills;
3. encontros entre jogadores passam a gerar pressao tatica, porque gastar energia reduz a economia imediata e tomar dano pode interromper a rota;
4. life regenera fora de combate, reduzindo necessidade de consumiveis no primeiro momento;
5. morte teleporta de volta ao respawn, reabrindo o loop de coleta e reposicionamento.

## Modelo Conceitual

### Estado privado do jogador

O estado privado do jogador deve passar a carregar:

```go
type PlayerCombatStatus struct {
  CurrentLife int       `json:"currentLife"`
  MaxLife int           `json:"maxLife"`
  LifeRegenPerSecond float64 `json:"lifeRegenPerSecond"`
  LifeRegenDelayMs int  `json:"lifeRegenDelayMs"`
  LastDamageAt time.Time `json:"-"`
  IsDead bool           `json:"isDead"`
  RespawnAt *time.Time  `json:"-"`
  SpawnProtectionUntil *time.Time `json:"-"`
}
```

Recomendacao de modelagem:

- integrar esse bloco em `PlayerProgress` ou em uma struct vizinha de ownership equivalente;
- manter `pollenCarried` e `pollenCapacity` como energia atual e maxima;
- nao duplicar `energyCurrent` enquanto `pollenCarried` continuar sendo o recurso canonico.

### Estado publico do jogador no mundo

Os snapshots de `players[]` devem expor apenas o necessario para leitura de combate:

```ts
interface WorldPlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  speed: number;
  currentLife: number;
  maxLife: number;
  isDead: boolean;
  combatTagUntil?: number;
}
```

Observacao:

- energia de outros jogadores nao precisa ser publica na V1;
- life de outros jogadores precisa ser publica para barras e feedback de dano;
- efeitos e status detalhados podem ficar em mensagens separadas no futuro.

### Evento de combate

Para feedback imediato e rastreabilidade, a spec recomenda adicionar uma mensagem dedicada de combate.

```ts
interface CombatEventMessage {
  type: "combat_event";
  eventId: string;
  eventKind: "damage" | "heal" | "death" | "respawn" | "blocked";
  sourcePlayerId?: string;
  targetPlayerId: string;
  skillId?: string;
  amount: number;
  reason?: string;
  timestamp: number;
}
```

Essa mensagem nao substitui `player_status`; ela complementa o HUD e reduz a necessidade de inferencia a partir de snapshots.

## Regras de Jogo Propostas

### R1. Life

- todo jogador nasce com `maxLife` configuravel;
- `currentLife` nunca passa de `maxLife`;
- dano nunca deixa `currentLife` negativo no protocolo publico;
- ao chegar em zero, o jogador entra em `isDead = true`.

Tuning inicial sugerido:

- `maxLife = 100`

### R2. Energia = Polen

- `pollenCarried` e a energia atual para cast;
- `pollenCapacity` e o teto de energia;
- toda skill passa a ter `energyCostPollen` alem do `costHoney` de aquisicao;
- se `pollenCarried < energyCostPollen`, o servidor rejeita o cast.

Tuning inicial sugerido:

- `Impulso`: `10 polen`
- `Atirar Ferrão`: `18 polen`
- `Slime de Mel`: `26 polen`
- `Flor de Néctar`: `24 polen`

### R3. Regeneracao de life

- life regenera automaticamente quando o jogador fica sem receber dano por uma janela minima;
- regeneracao pausa imediatamente ao receber novo dano;
- cura por skill pode coexistir com a regeneracao natural, mas as duas continuam autoritativas no servidor.

Tuning inicial sugerido:

- atraso para regenerar: `5s` apos o ultimo dano;
- taxa de regeneracao: `4 life/s`;
- regeneracao ocorre em ticks do servidor, nao em timers do client.

### R4. Morte e respawn

- quando `currentLife` chegar a `0`, o jogador morre;
- jogador morto nao se move, nao coleta, nao deposita e nao usa skills;
- apos uma janela curta de morte, o servidor respawna no ponto de spawn de perfil;
- o respawn limpa debuffs e efeitos ativos presos ao jogador;
- o respawn devolve life cheia.

Tuning inicial sugerido:

- atraso de respawn: `3s`;
- protecao apos respawn: `2s` ou ate o primeiro movimento/skill;
- `currentLife` no respawn: `100%`;
- `pollenCarried` no respawn: manter `0` por padrao na V1.

Observacao:

- renascer com `0` polen reforca o custo de morrer e evita cadeia imediata de skill no respawn;
- se isso ficar seco demais, a fase de balanceamento pode testar `10%` ou `20%` da capacidade como reserva inicial.

### R5. Tag de combate

Para suportar regen e clareza de estado:

- todo dano recebido atualiza `lastDamageAt`;
- o jogador e considerado `em combate` ate alguns segundos apos o ultimo dano;
- enquanto estiver em combate, a regeneracao natural de life nao comeca.

## Skills na V1 de combate

### S1. Impulso

Papel: mobilidade defensiva/ofensiva leve.

Na V1:

- continua sem dano;
- pode ser usado para fugir, perseguir ou sair de area;
- nao acerta diretamente outros jogadores;
- respeita bloqueios, colisao e zonas acessiveis;
- consome energia.

### S2. Atirar Ferrão

Papel: dano alvo por projectile.

Na V1:

- nasce como projectile autoritativo na direcao atual do jogador;
- colide com o primeiro jogador valido atingido;
- aplica dano direto;
- desaparece ao acertar, expirar ou bater em limite bloqueado;
- ativa feedback visual de hit no alvo e no HUD local.

Tuning inicial sugerido:

- dano base: `18`
- alcance guiado pelo runtime atual da skill

### S3. Slime de Mel

Papel: controle de area.

Na V1:

- cria area temporaria no chao;
- jogadores inimigos na area recebem lentidao;
- a V1 pode opcionalmente aplicar dano baixo por tick, mas a recomendacao inicial e começar apenas com lentidao para reduzir complexidade;
- entrar e sair da area atualiza estado autoritativo.

Tuning inicial sugerido:

- slow inicial: `30%`
- duracao do slow apos sair: `0.8s`

### S4. Flor de Néctar

Papel: sustain.

Na V1:

- cria area de suporte no chao;
- regenera life do dono enquanto ele estiver na area;
- a fase seguinte pode abrir a cura para outros jogadores ou aliados, mas a recomendacao inicial e limitar ao dono para simplificar leitura e tuning.

Tuning inicial sugerido:

- cura por segundo: `8`
- raio e duracao usam o runtime ja previsto para a skill.

## Escopo Funcional da Primeira Entrega

### E1. HUD local

Adicionar no HUD principal:

- barra de life do jogador local;
- barra ou medidor de `Energia (Pólen)`;
- leitura numerica opcional `vida atual / maxima`;
- feedback visual quando faltar energia para cast;
- estado morto/respawnando.

### E2. Barras nos outros jogadores

Adicionar leitura minima sobre jogadores visiveis:

- life bar compacta acima da abelha remota;
- estado morto claramente distinguivel;
- opcional: esconder a barra de life remota quando estiver cheia e fora de combate para reduzir ruido.

### E3. Runtime de combate no servidor

Adicionar runtime autoritativo para:

- gasto de energia no cast;
- hit detection de projectile e area;
- dano/cura;
- regen de life;
- morte e respawn automatico;
- protecao curta de spawn.

### E4. Protocolo

Expandir:

- `player_status` para life e estado local de morte/respawn;
- `players[]` para life publica minima;
- `skillCatalog` para custo de energia por cast;
- mensagem dedicada de `combat_event` para dano, cura, morte e respawn.

## Historias

### P1. Ver meu risco

Como jogador
Quero ver minha life atual no HUD
Para entender se devo fugir, curar ou continuar lutando

### P2. Usar polen como energia

Como jogador
Quero gastar polen ao usar skills
Para que meu combate tenha custo real e conversa com a coleta

### P3. Acertar outros jogadores

Como jogador
Quero que minhas skills ofensivas ou de area possam afetar outros jogadores
Para que encontros no mapa virem disputas reais

### P4. Voltar depois da derrota

Como jogador
Quero renascer automaticamente no respawn quando minha life acabar
Para que a morte feche o loop sem depender de acao manual

### P5. Recuperar life fora de combate

Como jogador
Quero recuperar life com o tempo quando eu sair de combate
Para reduzir friccao na exploracao e diminuir dependencia de itens na V1

## Requisitos

- `REQ-PLPC-001` WHEN um jogador conectar ou receber `player_status` THEN o servidor SHALL incluir `currentLife`, `maxLife` e estado de morte/respawn no payload privado.
- `REQ-PLPC-002` WHEN o cliente renderizar o HUD local THEN ele SHALL exibir barra de life e medidor de `Energia (Pólen)` usando dados autoritativos.
- `REQ-PLPC-003` WHEN uma skill for exibida no catalogo/runtime THEN o payload SHALL incluir `energyCostPollen` separado de `costHoney`.
- `REQ-PLPC-004` WHEN o jogador tentar usar uma skill e `pollenCarried` for insuficiente THEN o servidor SHALL rejeitar o cast com razao explicita de energia insuficiente.
- `REQ-PLPC-005` WHEN o cast for aceito THEN o servidor SHALL descontar energia antes de publicar os efeitos desse cast.
- `REQ-PLPC-006` WHEN um jogador visivel estiver no mundo THEN o snapshot publico SHALL incluir `currentLife`, `maxLife` e `isDead` para leitura remota minima.
- `REQ-PLPC-007` WHEN `Atirar Ferrão` colidir com outro jogador valido THEN o servidor SHALL aplicar dano autoritativo ao alvo.
- `REQ-PLPC-008` WHEN `Slime de Mel` estiver ativa THEN o servidor SHALL aplicar ao menos lentidao autoritativa a jogadores afetados na area.
- `REQ-PLPC-009` WHEN `Flor de Néctar` estiver ativa e o dono estiver dentro da area THEN o servidor SHALL aplicar cura autoritativa por tick.
- `REQ-PLPC-010` WHEN `Impulso` for usada THEN ela SHALL consumir energia, mas SHALL nao causar dano direto na V1.
- `REQ-PLPC-011` WHEN um jogador receber dano THEN o servidor SHALL atualizar `lastDamageAt` e reiniciar a janela de atraso da regeneracao natural.
- `REQ-PLPC-012` WHEN o jogador ficar sem receber dano pela janela configurada THEN o servidor SHALL iniciar a regeneracao automatica de life em ticks.
- `REQ-PLPC-013` WHEN `currentLife` atingir `0` THEN o servidor SHALL marcar o jogador como morto, bloquear suas acoes jogaveis e agendar respawn automatico.
- `REQ-PLPC-014` WHEN o tempo de respawn expirar THEN o servidor SHALL reposicionar o jogador no ponto de spawn do perfil.
- `REQ-PLPC-015` WHEN o respawn ocorrer THEN o servidor SHALL restaurar a life, limpar estados de combate e remover ou invalidar efeitos presos ao jogador morto.
- `REQ-PLPC-016` WHEN o jogador estiver morto THEN `move`, `move_to`, `collect_flower`, `deposit_honey`, `use_skill`, `buy_skill`, `equip_skill` e `upgrade_skill` SHALL ser rejeitados se violarem a regra de morte definida para a V1.
- `REQ-PLPC-017` WHEN o respawn terminar THEN o jogador SHALL receber protecao curta contra dano repetido em spawn.
- `REQ-PLPC-018` WHEN a protecao de spawn estiver ativa THEN ela SHALL ser removida ao fim do tempo ou no primeiro comportamento ofensivo configurado.
- `REQ-PLPC-019` WHEN dano, cura, morte ou respawn acontecerem THEN o servidor SHALL emitir `combat_event` ou mensagem equivalente para feedback imediato do cliente.
- `REQ-PLPC-020` WHEN o cliente receber um evento de combate THEN ele SHALL refletir feedback visual local sem divergir do snapshot autoritativo.
- `REQ-PLPC-021` WHEN o jogador estiver com life cheia e fora de combate THEN o HUD MAY reduzir destaque da regeneracao para evitar ruido visual.
- `REQ-PLPC-022` WHEN o jogador morrer THEN o fluxo SHALL nao depender do `respawn` manual atual para voltar ao mundo.
- `REQ-PLPC-023` WHEN o projeto precisar evoluir para PvE THEN o contrato de dano/cura desta fase SHALL poder ser reutilizado para NPCs e criaturas.
- `REQ-PLPC-024` WHEN um efeito ofensivo do proprio jogador existir THEN ele SHALL nao acertar o dono na V1, salvo decisao futura explicita.
- `REQ-PLPC-025` WHEN um jogador desconectar morto ou em respawn THEN reconexao futura SHALL convergir para um estado valido decidido pelo servidor.
- `REQ-PLPC-026` WHEN o jogador tentar depositar polen na colmeia THEN a conversao para mel SHALL continuar consumindo o mesmo recurso usado como energia.
- `REQ-PLPC-027` WHEN o jogador tiver `0` polen apos deposito ou respawn THEN o HUD SHALL indicar claramente que nao ha energia para skill.
- `REQ-PLPC-028` WHEN multiplos efeitos e jogadores estiverem ativos THEN o runtime SHALL permanecer leve e evitar loops quadráticos desnecessarios.

## Criterios de Aceitacao

- `AC-PLPC-001` Dado um jogador conectado, quando o HUD carregar, entao ele ve sua barra de life e seu medidor de `Energia (Pólen)`.
- `AC-PLPC-002` Dado `Atirar Ferrão` pronta e energia suficiente, quando o jogador usar a skill e acertar outro jogador, entao o alvo perde life e ambos recebem feedback coerente.
- `AC-PLPC-003` Dado energia insuficiente, quando o jogador tentar usar qualquer skill, entao nenhum efeito nasce e o feedback informa falta de energia.
- `AC-PLPC-004` Dado um jogador fora de combate com life incompleta, quando o atraso de regen terminar, entao sua life sobe automaticamente ate o maximo.
- `AC-PLPC-005` Dado um jogador recebendo dano repetido, quando ele continua sob ataque, entao a regen natural nao comeca entre um hit e outro.
- `AC-PLPC-006` Dado um jogador com `currentLife = 1`, quando ele recebe dano letal, entao fica morto, perde acesso a acoes jogaveis e entra em contagem de respawn.
- `AC-PLPC-007` Dado um jogador morto, quando o tempo de respawn termina, entao ele reaparece no spawn com life cheia.
- `AC-PLPC-008` Dado um jogador recem-respawnado, quando outro jogador tenta causar dano imediatamente, entao a protecao curta de spawn evita morte instantanea em loop.
- `AC-PLPC-009` Dado que `pollenCarried` e a energia atual, quando o jogador deposita todo o polen na colmeia, entao o medidor de energia vai para zero e as skills passam a falhar por falta de energia.
- `AC-PLPC-010` Dado `Flor de Néctar` ativa, quando o dono permanece dentro da area fora de morte, entao ele recebe cura autoritativa conforme a regra.
- `AC-PLPC-011` Dado `Slime de Mel` ativa, quando outro jogador entra na area, entao ele fica lento de acordo com a regra configurada.
- `AC-PLPC-012` Dado um reconnect no meio de combate ou respawn, quando o servidor sincroniza o estado, entao o cliente converge para a life e o estado corretos.

## Contrato de Protocolo Recomendado

### `player_status`

Adicionar:

- `currentLife`
- `maxLife`
- `isDead`
- `respawnEndsAt?`
- `spawnProtectionEndsAt?`

Manter:

- `pollenCarried`
- `pollenCapacity`
- `honey`
- `skillRuntime`
- `skillCatalog`

### `skillCatalog`

Adicionar em cada skill:

- `energyCostPollen`
- `canAffectPlayers`
- `combatRole` opcional no futuro

### `state.players[]`

Adicionar:

- `currentLife`
- `maxLife`
- `isDead`

### `combat_event`

Nova mensagem recomendada para:

- dano recebido
- cura aplicada
- morte
- inicio/fim de respawn
- blocked ou negacao relevante de combate

## Fases de Evolucao Recomendadas

### Fase 1. Modelo e protocolo

Entregar:

- campos de life no servidor e no cliente;
- custo de energia nas skills;
- `player_status` e `players[]` expandidos;
- HUD local de life e energia.

Objetivo:

- deixar o combate legivel antes de finalizar dano e morte.

### Fase 2. Hit detection e efeitos entre jogadores

Entregar:

- dano de `Atirar Ferrão`;
- slow de `Slime de Mel`;
- cura de `Flor de Néctar`;
- feedback `combat_event`.

Objetivo:

- tornar o encontro entre jogadores funcional sem ainda fechar a morte.

### Fase 3. Regeneracao, morte e respawn

Entregar:

- regen automatica de life;
- bloqueio de acoes ao morrer;
- respawn automatico;
- protecao curta de spawn;
- limpeza de estado de combate.

Objetivo:

- fechar o loop completo de combate e retorno ao mapa.

### Fase 4. Balanceamento e extensoes

Entregar:

- tuning de custos e dano;
- avaliacao do acoplamento `polen = energia`;
- opcao de barras remotas condicionais;
- preparacao de NPCs e PvE.

Objetivo:

- estabilizar a feature depois que o fluxo principal funcionar.

## Impacto Esperado por Camada

### Backend

- ampliar `PlayerProgress` ou struct equivalente com estado de combate;
- incluir tick de regen e tick de respawn no loop do servidor;
- validar acoes quando `isDead = true`;
- resolver dano/cura/slow por efeito runtime ja existente;
- publicar eventos de combate e novos campos de snapshot.

### Frontend

- ampliar tipos em `client/src/types/game.ts`;
- atualizar `useGameSession` para consumir `combat_event` e novos campos;
- adicionar life bar local e life bars remotas;
- atualizar slots/feed para razoes de falta de energia, dano e respawn;
- renderizar estado morto e protegido.

### UX

- life local deve ser sempre visivel;
- energia deve comunicar que e o mesmo recurso do polen carregado;
- feedback de respawn deve ser claro, curto e nao bloquear a partida alem do necessario;
- inimigos mortos ou protegidos devem ser legiveis no mundo.

## Riscos

- acoplar energia ao polen pode aumentar friccao economica alem do desejado;
- barras remotas permanentes podem poluir a cena;
- respawn sem protecao pode gerar loop de morte;
- cura em area e regen natural podem se sobrepor e banalizar risco;
- efeitos em area com verificacoes ingênuas podem pesar com muitos jogadores.

## Mitigacoes

- comecar com tuning conservador de custo, dano e cura;
- limitar barras remotas a contexto de combate ou proximidade;
- adicionar invulnerabilidade curta no respawn;
- avaliar `Slime de Mel` sem dano por tick na V1;
- manter verificacoes de colisao por stage/visibilidade/range, nao por varredura global desnecessaria.

## Notas de Tuning da V1

Valores atualmente implementados na camada de combate:

- `maxLife`: `100`
- regen natural: `4 life/s`
- atraso da regen natural: `5s` apos o ultimo dano
- tag de combate: `5s`
- respawn automatico: `3s`
- protecao apos respawn: `2s`
- dano base de `Atirar Ferrão`: `18`
- custo de energia em polen: `10` `Impulso`, `18` `Atirar Ferrão`, `26` `Slime de Mel`, `24` `Flor de Néctar`
- `Slime de Mel`: slow de `30%` com persistencia curta de `0.8s` apos contato
- `Flor de Néctar`: cura base de `8 life/s`

Decisoes operacionais da V1:

- `Impulso` consome energia, mas nao causa dano direto;
- `Atirar Ferrão` acerta o primeiro alvo valido no trajeto e nao acerta o proprio dono;
- `Slime de Mel` atua como controle, sem dano por tick nesta fase;
- `Flor de Néctar` cura apenas o proprio dono nesta fase;
- morrer zera o polen carregado para evitar cadeia imediata de cast no respawn.

Notas de consistencia e extremos:

- ao desconectar, o servidor limpa `activeCollections` e `activeCombatAreas` do jogador para evitar runtime zumbi;
- ao reconectar durante o estado morto, o progresso preserva `isDead` e `respawnEndsAt`, permitindo o HUD convergir para a contagem restante;
- no cliente, timeouts de feedback de interacao/combate sao limpos ao desconectar para nao vazar estado antigo para uma sessao nova.

Limites conhecidos desta iteracao:

- a reconexao preserva o estado de combate do jogador, mas ainda nao existe um fluxo visual dedicado de rejoin alem do `player_status` e `combat_event`;
- barras remotas de life estao sempre visiveis nesta fase e podem ser refinadas por proximidade ou contexto de combate em iteracao futura;
- observabilidade ainda esta apoiada principalmente em testes e leitura de protocolo, nao em metricas dedicadas.

## Perguntas em Aberto

- `Flor de Néctar` cura so o dono na V1 ou qualquer jogador dentro da area?
- a V1 deve considerar friendly fire inexistente porque ainda nao ha times?
- `Impulso` remove protecao de spawn por ser acao ofensiva ou apenas movimento?
- a barra de life remota fica sempre visivel ou so quando o alvo toma dano/entra em combate?
- a morte deve zerar polen sempre, ou apenas manter o valor ja gasto/perdido no estado atual?

## Recomendacao Final

Para chegar nesse ponto com menor risco, a evolucao recomendada e:

1. assumir `pollenCarried` como energia imediatamente, sem criar sistema paralelo;
2. colocar `life` no protocolo e no HUD antes de mexer no balanceamento fino;
3. transformar `Atirar Ferrão` em primeira skill real de dano entre jogadores;
4. usar `Slime de Mel` para controle e `Flor de Néctar` para sustain, evitando abrir todas as variacoes de combate de uma vez;
5. fechar o loop com regen, morte automatica, respawn e spawn protection;
6. so depois decidir se `polen = energia` continua ideal ou se merece split em uma iteracao futura.