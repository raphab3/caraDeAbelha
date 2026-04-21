# Cara de Abelha MMORPG Foundation

Status: approved

## Objetivo

Formalizar a evolucao do Cara de Abelha de um sandbox multiplayer de movimentacao para um MMORPG cooperativo de navegador com progressao, especializacao de personagem e eventos de grupo.

## Problema

A experiencia atual valida sessao, mundo compartilhado e movimento autoritativo, mas ainda nao entrega um loop de retencao. Sem coleta, conversao, progressao, combate e cooperacao significativa, o jogo corre o risco de cair no padrao de repeticao rasa dos simuladores sem profundidade.

## Usuario

Jogadores que buscam progressao continua, crescimento do personagem e atividades cooperativas em um mundo multiplayer com fantasia de abelha.

## Dor

O jogador ainda nao tem:

- um loop economico jogavel com recompensa imediata
- escolhas de build ou papel no grupo
- inimigos e PvE que deem proposito ao crescimento
- eventos cooperativos que transformem presenca simultanea em MMO real

O time tambem precisa de uma evolucao em fases para evitar feature creep e preservar o modelo autoritativo do servidor.

## Metas

- Definir a visao guarda-chuva do produto em sistemas independentes e rastreaveis.
- Delimitar o primeiro slice implementavel como `coletar polen -> voltar a colmeia -> converter em mel`.
- Preparar a expansao posterior para progressao RPG, PvE, quests, helpers e eventos cooperativos.
- Preservar o servidor em Go como fonte da verdade e o client como renderizacao, input e HUD.
- Organizar a iniciativa em tres epics claros: `Loop Base`, `Camada RPG`, `Dinamica MMO`.

## Restricoes

- O servidor SHALL continuar autoritativo para estado de mundo, economia, combate e recompensas.
- O client SHALL continuar enviando intencoes e nao resultados autoritativos.
- O MVP inicial SHALL terminar em coleta por clique na flor e conversao automatica em mel ao entrar na colmeia.
- A introducao de sistemas novos SHALL ser incremental, sem exigir refactor estrutural total antes da primeira entrega jogavel.
- A especificacao SHALL separar visao de longo prazo de escopo obrigatorio do primeiro slice.

## Fora de Escopo

- PvP, guildas, trade entre jogadores e marketplace.
- Monetizacao, passes, cosmeticos premium ou live ops.
- Escala horizontal com Redis.
- Balanceamento final de numeros, tabelas completas de loot ou conteudo narrativo extenso.
- Implementacao detalhada de UI final, motion ou direcao de arte definitiva.
- Persistencia completa de todos os sistemas ja no primeiro slice.

## Criterios de Sucesso

- O jogador consegue entrar no mundo, clicar em flores validas, encher a mochila, voltar a colmeia e receber mel.
- O loop base produz feedback visivel no HUD e no estado autoritativo.
- A iniciativa fica quebrada em tres historias macro independentemente testaveis.
- A camada RPG passa a ter contratos claros para equipamento, skills, quests e PvE.
- A camada MMO passa a ter contratos claros para contribuicao, recompensa e sinergia de grupo.

## Historias

### P1. Loop Base de Coleta

Como jogador
Quero coletar polen, carregar uma mochila limitada e converter esse polen em mel na colmeia
Para que o jogo tenha um loop economico central, claro e repetivel

### P2. Camada RPG de Progressao

Como jogador
Quero evoluir meu personagem com equipamentos, skills, quests e combate PvE
Para que meu crescimento dependa de escolhas de build e nao apenas de repeticao de coleta

### P3. Dinamica Co-op e MMO

Como jogador
Quero participar de eventos e batalhas cooperativas com recompensa por contribuicao e papeis complementares
Para que jogar com outras pessoas seja mecanicamente melhor do que apenas jogar lado a lado

## Requisitos

- `REQ-CDAM-001` WHEN o jogador clicar em uma flor valida dentro do alcance de interacao THEN o servidor SHALL adicionar polen ao estado do jogador de forma autoritativa.
- `REQ-CDAM-002` WHEN a mochila do jogador atingir sua capacidade maxima THEN o servidor SHALL interromper o ganho adicional de polen ate que haja conversao ou liberacao de espaco.
- `REQ-CDAM-003` WHEN o jogador entrar em uma colmeia valida carregando polen THEN o servidor SHALL converter o polen em mel segundo uma regra definida de conversao e SHALL limpar o polen transportado.
- `REQ-CDAM-004` WHEN o estado de polen, capacidade ou mel do jogador mudar THEN o client SHALL refletir esse estado em HUD com feedback legivel para tomada de decisao.
- `REQ-CDAM-005` WHEN o jogador acumular mel THEN o sistema SHALL tratar mel como moeda de progressao para gates definidos do loop base e suas expansoes.
- `REQ-CDAM-006` WHEN o jogador tentar acessar uma zona bloqueada sem permissao THEN o servidor SHALL negar acesso ou interacao ate que a condicao de desbloqueio seja satisfeita.
- `REQ-CDAM-007` WHEN a camada RPG for ativada THEN o sistema SHALL suportar ao menos armas, armaduras e atributos derivados calculados no servidor.
- `REQ-CDAM-008` WHEN o jogador ganhar pontos de habilidade por progressao THEN o sistema SHALL permitir gasto em pelo menos um caminho de coleta e um caminho de combate sem depender do saldo de mel.
- `REQ-CDAM-009` WHEN um inimigo detectar um jogador em condicao valida de aggro THEN o servidor SHALL transicionar esse inimigo para um estado ativo de perseguicao ou ataque.
- `REQ-CDAM-010` WHEN o jogador concluir objetivos de PvE ou quest THEN o sistema SHALL conceder recompensas compativeis como XP, itens ou progresso de objetivo.
- `REQ-CDAM-011` WHEN helpers, pets ou abelhas operarias forem introduzidos THEN o sistema SHALL trata-los como entidades auxiliares com comportamento e contribuicao controlados pelo servidor.
- `REQ-CDAM-012` WHEN um evento cooperativo global estiver ativo THEN o servidor SHALL rastrear contribuicao individual e SHALL distribuir recompensas por regra explicita de participacao.
- `REQ-CDAM-013` WHEN multiplos jogadores compuserem papeis ou skills complementares THEN o sistema SHALL oferecer valor mecanico adicional de grupo alem de soma simples de dano.
- `REQ-CDAM-014` WHEN novos sistemas de coleta, combate, quest ou evento forem adicionados THEN o client SHALL continuar operando como consumidor de estado e emissor de intencao, preservando o modelo autoritativo do servidor.
- `REQ-CDAM-015` WHEN a iniciativa for quebrada em epics THEN cada epic SHALL ser testavel de forma independente e SHALL produzir um incremento jogavel ou validavel do produto.

## Criterios de Aceitacao

- `AC-CDAM-001` WHEN um jogador valido clicar em uma flor dentro do alcance THEN a mochila SHALL aumentar ate seu limite configurado.
- `AC-CDAM-002` WHEN a mochila atingir o limite THEN o jogador SHALL parar de ganhar polen ate converter ou liberar capacidade.
- `AC-CDAM-003` WHEN o jogador entrar na colmeia com polen armazenado THEN o polen SHALL ser zerado e o mel SHALL aumentar no estado autoritativo.
- `AC-CDAM-004` WHEN o loop base estiver aceito THEN o HUD SHALL mostrar pelo menos estado de polen atual, capacidade maxima e saldo de mel.
- `AC-CDAM-005` WHEN uma zona bloqueada fizer parte do loop base expandido THEN um jogador sem desbloqueio SHALL nao conseguir acessar seus beneficios ate cumprir a regra de liberacao.
- `AC-CDAM-006` WHEN a camada RPG estiver aceita THEN o jogo SHALL suportar pelo menos um inimigo hostil, um slot de arma, um slot de armadura e um gasto valido de skill point.
- `AC-CDAM-007` WHEN um inimigo hostil detectar um jogador THEN ele SHALL entrar em comportamento ativo definido pelo servidor sem depender de logica local do client.
- `AC-CDAM-008` WHEN uma quest valida for concluida THEN o jogador SHALL receber progresso e recompensa compativeis com sua definicao.
- `AC-CDAM-009` WHEN um evento cooperativo global for concluido THEN os participantes SHALL receber recompensas proporcionais a regra de contribuicao definida.
- `AC-CDAM-010` WHEN multiplos jogadores atuarem em cooperacao THEN pelo menos uma combinacao de papeis ou skill effects SHALL produzir ganho mecanico observavel no encontro.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-CDAM-001` | P1 | coleta autoritativa de polen |
| `REQ-CDAM-002` | P1 | limite de mochila respeitado |
| `REQ-CDAM-003` | P1 | conversao de polen em mel |
| `REQ-CDAM-004` | P1 | HUD do loop base fica legivel |
| `REQ-CDAM-005` | P1 | mel vira moeda real de progressao |
| `REQ-CDAM-006` | P1 | zonas podem ser bloqueadas ou desbloqueadas |
| `REQ-CDAM-007` | P2 | equipamento e atributos entram no servidor |
| `REQ-CDAM-008` | P2 | progressao por skill point independe de mel |
| `REQ-CDAM-009` | P2 | PvE com aggro autoritativo |
| `REQ-CDAM-010` | P2 | quests e PvE recompensam progresso |
| `REQ-CDAM-011` | P2 | helpers entram como sistema formal |
| `REQ-CDAM-012` | P3 | eventos globais rastreiam contribuicao |
| `REQ-CDAM-013` | P3 | cooperacao gera sinergia real |
| `REQ-CDAM-014` | P1, P2, P3 | arquitetura servidor-autoritativo e preservada |
| `REQ-CDAM-015` | P1, P2, P3 | epics ficam independentes e validaveis |

## Decomposicao Inicial dos Epics

### Epic 1. Loop Base e Economia Inicial

Resultado esperado: estabelecer o loop `coletar -> carregar -> converter -> acumular mel`, com HUD e contratos de progressao base preparados para zonas bloqueadas.

### Epic 2. Progressao RPG e PvE

Resultado esperado: adicionar equipamentos, skill points, inimigos com aggro, quests e helpers como sistemas formais de progressao.

### Epic 3. Cooperacao MMO e Eventos Globais

Resultado esperado: adicionar world bosses, contribuicao por participacao, distribuicao de loot e sinergias de grupo relevantes.

## Assuncoes

- Esta spec e guarda-chuva e organiza a visao de produto, nao o design tecnico detalhado.
- O primeiro aceite obrigatorio da iniciativa termina em `coleta + conversao em mel`.
- Combate basico, zonas desbloqueaveis, quests e world boss entram como evolucao posterior dentro dos epics seguintes.
- Numeros de balanceamento, formulas exatas e contratos de payload detalhados ficam para a fase de design.