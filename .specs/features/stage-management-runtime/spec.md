# Stage Management Runtime

Status: draft
Feature: stage-management-runtime
Source: solicitacao em chat sobre multiplos mapas, admin de stages e evitar deploy para publicar JSON do builder

## Objetivo

Permitir que o Cara de Abelha gerencie multiplos stages criados pelo builder, publique ou troque mapas sem redeploy e prepare o runtime para que jogadores possam estar em mapas diferentes no futuro.

## Problema

Hoje o backend carrega um unico arquivo em startup (`server/maps/map.json` ou `CARA_DE_ABELHA_MAP_PATH`). Cada novo stage exige substituir arquivo, commitar/deployar e reiniciar o servidor. Esse fluxo trava iteracao de conteudo, dificulta rollback e nao escala para multiplos mapas simultaneos.

## Usuarios

- Administrador que cria, valida, publica e arquiva stages.
- Jogador que entra no mundo ativo hoje e, no futuro, pode estar em outro stage.
- Operador tecnico que precisa publicar conteudo com baixo risco e sem rebuild da aplicacao.

## Dor

- Criar um JSON no builder ainda exige mover arquivo manualmente para `server/maps/map.json`.
- Nao existe catalogo de stages, historico de versoes ou rollback.
- O runtime assume um `worldLayout` unico, o que dificulta multi-map por player.
- Reprocessar JSON em tempo de jogo pode prejudicar performance se nao houver cache/compilacao.

## Metas

- Persistir stages e versoes fora do artefato de deploy, preferencialmente em Postgres.
- Permitir importar JSON gerado pelo Map Builder Pro pelo admin.
- Validar, versionar, publicar, ativar, arquivar e exportar stages.
- Manter o stage ativo compilado em memoria para performance.
- Introduzir `stageRuntime` como unidade isolada de mundo, players, flores, hives, chunks e broadcasts.
- Suportar MVP com um stage ativo global, sem bloquear evolucao para jogadores em stages diferentes.

## Restricoes

- A V1 SHALL preservar compatibilidade com o contrato atual de `worldMapContainer`.
- O backend SHALL nao ler stage publicado do filesystem a cada conexao.
- O admin SHALL validar payload antes de publicar.
- A troca de stage ativo SHALL ser controlada e nao devera corromper sessoes WebSocket ativas.
- Stages publicados SHALL ser versionados; editar um stage publicado cria nova versao.
- Multi-map completo por player e instancia entra como evolucao, mas o modelo inicial SHALL usar `stageId`.

## Fora de Escopo

- Edicao colaborativa em tempo real.
- Upload de assets `.glb` arbitrarios.
- Sharding horizontal entre varios processos.
- Migracao completa de progresso por stage na V1.
- Marketplace publico de mapas.

## Modelo Proposto

### Persistencia

- `stages`: entidade logica do mapa (`id`, `slug`, `displayName`, `status`, `createdAt`, `updatedAt`).
- `stage_versions`: versoes imutaveis (`id`, `stageId`, `version`, `sourceJson`, `checksum`, `validationStatus`, `publishedAt`).
- `game_config`: configuracao operacional (`activeStageVersionId`, `defaultStageId`).
- Futuro: `player_profiles.currentStageId` para manter cada jogador em seu stage atual.

### Runtime

O backend deve evoluir de um `worldLayout` global para um registro de runtimes:

```go
type gameHub struct {
  stageRegistry *stageRegistry
  profiles map[string]*playerProfile
}

type stageRuntime struct {
  stageID string
  versionID string
  layout worldLayout
  players map[string]*playerState
  activeFlowers map[string]*activeFlowerRuntime
  activeHives map[string]*activeHiveRuntime
}
```

No MVP, apenas o stage padrao precisa estar ativo. No futuro, o hub podera manter `map[stageID]*stageRuntime`.

## Historias

### P1. Importar stage sem deploy

Como administrador
Quero importar o JSON gerado pelo builder no admin
Para disponibilizar um stage sem alterar arquivos do projeto nem fazer deploy

### P2. Validar e versionar stage

Como administrador
Quero validar e versionar cada importacao
Para evitar publicar JSON invalido e poder voltar para uma versao anterior

### P3. Publicar stage com performance

Como operador
Quero publicar um stage ja compilado em memoria
Para que o jogo use o mapa novo sem parsear JSON em cada conexao

### P4. Preparar multi-map por player

Como mantenedor
Quero isolar estado por `stageRuntime`
Para permitir que jogadores estejam em stages diferentes no futuro

### P5. Gerenciar stages no admin

Como administrador
Quero listar, revisar, publicar, arquivar e fazer rollback de stages
Para controlar o ciclo de vida dos mapas dentro da ferramenta interna

## Requisitos

- `REQ-SMR-001` WHEN o admin importar um JSON THEN o backend SHALL validar o payload contra o contrato atual de stage antes de salvar como versao valida.
- `REQ-SMR-002` WHEN uma importacao for salva THEN o sistema SHALL persistir uma nova `stage_version` imutavel com checksum.
- `REQ-SMR-003` WHEN uma versao for publicada THEN o sistema SHALL compilar o JSON para `worldLayout` e manter o layout em cache de runtime.
- `REQ-SMR-004` WHEN o stage ativo for alterado THEN o sistema SHALL atualizar a configuracao operacional sem exigir redeploy.
- `REQ-SMR-005` WHEN o servidor iniciar THEN ele SHALL carregar o stage ativo do storage persistente e SHALL cair para `server/maps/map.json` apenas como fallback configurado.
- `REQ-SMR-006` WHEN um stage publicado tiver versao anterior THEN o admin SHALL conseguir fazer rollback para essa versao.
- `REQ-SMR-007` WHEN o admin listar stages THEN a resposta SHALL incluir status, versao publicada, versao ativa, tamanho do payload, checksum e datas relevantes.
- `REQ-SMR-008` WHEN uma versao for invalida THEN ela SHALL ficar indisponivel para publicacao e SHALL expor erros de validacao.
- `REQ-SMR-009` WHEN o runtime processar movimento, coleta, hives ou broadcast THEN a operacao SHALL ocorrer dentro do `stageRuntime` do jogador.
- `REQ-SMR-010` WHEN multi-map for habilitado THEN jogadores em stages diferentes SHALL nao receber chunks, players ou broadcasts uns dos outros.
- `REQ-SMR-011` WHEN um jogador entrar sem stage salvo THEN ele SHALL entrar no stage padrao configurado.
- `REQ-SMR-012` WHEN um jogador trocar de stage futuramente THEN seu estado runtime SHALL ser removido do stage anterior e adicionado ao stage destino de forma consistente.
- `REQ-SMR-013` WHEN o admin arquivar um stage THEN ele SHALL permanecer no historico, mas nao SHALL ser selecionavel como novo stage ativo.
- `REQ-SMR-014` WHEN o admin exportar uma versao THEN o sistema SHALL retornar o JSON original ou normalizado dessa versao.
- `REQ-SMR-015` WHEN uma publicacao ocorrer THEN o backend SHOULD registrar auditoria minima com usuario, timestamp, stage e version.

## Criterios de Aceitacao

- `AC-SMR-001` Dado um JSON valido do Map Builder, quando o admin importar, entao uma nova versao valida aparece na lista de stages.
- `AC-SMR-002` Dado um JSON invalido, quando o admin importar, entao a versao nao pode ser publicada e os erros sao exibidos.
- `AC-SMR-003` Dado um stage publicado, quando o admin define como ativo, entao novas sessoes passam a receber `stageId` e chunks desse stage sem novo deploy.
- `AC-SMR-004` Dado um stage ativo, quando o servidor reinicia, entao o runtime carrega esse stage do banco.
- `AC-SMR-005` Dado duas versoes publicadas de um stage, quando o admin faz rollback, entao a versao anterior vira ativa.
- `AC-SMR-006` Dado dois jogadores em stages diferentes no modo futuro multi-map, quando um se move, entao o outro nao recebe broadcast desse movimento.
- `AC-SMR-007` Dado o admin de stages, quando a lista carrega, entao ela mostra status, versoes, checksum e acoes permitidas.

## Admin UX

A rota recomendada e `/admin/stages`.

Tela principal:

- tabela de stages com status (`draft`, `valid`, `published`, `active`, `archived`);
- acao `Importar JSON`;
- acao `Validar`;
- acao `Publicar versao`;
- acao `Definir como ativo`;
- acao `Rollback`;
- acao `Arquivar`;
- acao `Exportar JSON`;
- detalhe com historico de versoes e erros de validacao.

## Performance

- O JSON deve ser parseado e validado em importacao/publicacao, nao no loop de jogo.
- O `worldLayout` ativo deve ficar em memoria.
- Multi-map futuro deve carregar runtimes sob demanda e descarregar stages sem players ativos.
- Operacoes frequentes devem usar estruturas ja chunkadas por stage.
- Checksums devem evitar recompilar versoes identicas.

## Rastreabilidade

| ID | Historia | Resultado esperado |
|---|---|---|
| `REQ-SMR-001` | P1, P2 | importacao segura |
| `REQ-SMR-002` | P2 | historico imutavel |
| `REQ-SMR-003` | P3 | runtime performatico |
| `REQ-SMR-004` | P1, P3 | publicacao sem deploy |
| `REQ-SMR-005` | P3 | restart preserva stage ativo |
| `REQ-SMR-006` | P2, P5 | rollback operacional |
| `REQ-SMR-007` | P5 | admin tem visibilidade |
| `REQ-SMR-008` | P2 | invalido nao vai para producao |
| `REQ-SMR-009` | P4 | isolamento por runtime |
| `REQ-SMR-010` | P4 | multi-map sem vazamento de broadcast |
| `REQ-SMR-011` | P4 | entrada no stage padrao |
| `REQ-SMR-012` | P4 | troca futura consistente |
| `REQ-SMR-013` | P5 | arquivamento seguro |
| `REQ-SMR-014` | P5 | exportacao recuperavel |
| `REQ-SMR-015` | P5 | auditoria minima |

## Assuncoes

- Postgres sera usado como storage persistente por ja existir no projeto.
- A primeira entrega pode manter apenas um stage ativo global.
- O modelo deve usar `stageId` e `stageVersionId` desde o inicio para evitar retrabalho no multi-map.
- O fallback por arquivo continua util para desenvolvimento local e recuperacao.
