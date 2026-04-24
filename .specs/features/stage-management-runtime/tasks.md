# Tasks - Stage Management Runtime

Status: ready
Feature: stage-management-runtime
Spec: `.specs/features/stage-management-runtime/spec.md`

## Premissas de execucao

- executar de forma incremental, preservando o fluxo atual com `server/maps/map.json` como fallback;
- nao mover todos os jogadores para multi-map completo na primeira fatia;
- priorizar importacao, validacao, versionamento e publicacao sem deploy;
- manter `worldLayout` compilado em memoria, sem parse de JSON por conexao;
- validar backend com `make server-test` e integracoes frontend com `pnpm --dir client typecheck` / `pnpm --dir client build`;
- qualquer endpoint admin mutavel deve ser preparado para autenticação futura, mesmo que a autenticação ainda nao exista.

## Task list

- [ ] `TASK-SMR-01` Criar modelo persistente de stages e stage_versions.
- [ ] `TASK-SMR-02` Extrair parser/validador reutilizavel de stage JSON.
- [ ] `TASK-SMR-03` Criar registry de stages e cache de `worldLayout` ativo.
- [ ] `TASK-SMR-04` Adicionar endpoints admin para listar, importar, validar e exportar stages.
- [ ] `TASK-SMR-05` Adicionar publicacao, ativacao e rollback de stage version.
- [ ] `TASK-SMR-06` Criar UI `/admin/stages` para gerenciar stages.
- [ ] `TASK-SMR-07` Integrar Map Builder Pro com importacao direta no admin.
- [ ] `TASK-SMR-08` Preparar `stageRuntime` no backend sem habilitar multi-map completo.
- [ ] `TASK-SMR-09` Persistir stage padrao/ativo no restart e manter fallback por arquivo.
- [ ] `TASK-SMR-10` Documentar fluxo operacional e criterios de performance.

## Detalhamento

### `TASK-SMR-01` Criar modelo persistente de stages

Deliverable: migrations SQL e tipos Go para persistir catalogo de stages, versoes e configuracao ativa.

Requirement IDs:

- `REQ-SMR-002`
- `REQ-SMR-004`
- `REQ-SMR-006`
- `REQ-SMR-007`
- `REQ-SMR-013`
- `REQ-SMR-015`

Arquivos provaveis:

- `server/internal/dbmigrate/migrations/002_stage_management.sql`
- `server/internal/httpserver/stages_store.go`
- `server/internal/httpserver/stages_models.go`
- `infra/postgres/init.sql`

Done when:

- existem tabelas `stages`, `stage_versions` e `game_config`;
- cada versao armazena JSON, checksum, status de validacao e timestamps;
- status de stage suporta `draft`, `published`, `active` e `archived`;
- `go test ./...` passa.

### `TASK-SMR-02` Extrair parser/validador reutilizavel

Deliverable: parser de stage separado do carregamento por arquivo, reutilizavel por importacao admin e startup.

Requirement IDs:

- `REQ-SMR-001`
- `REQ-SMR-003`
- `REQ-SMR-008`
- `REQ-SMR-014`

Arquivos provaveis:

- `server/internal/httpserver/world_map.go`
- `server/internal/httpserver/stage_validation.go`
- `server/internal/httpserver/stage_validation_test.go`

Done when:

- existe funcao pura para validar bytes JSON e retornar `worldLayout` ou erros estruturados;
- formato legado e container atual continuam suportados;
- payload invalido retorna erros acionaveis para o admin;
- testes cobrem JSON valido, JSON invalido, prefab desconhecido e stage vazio.

### `TASK-SMR-03` Criar registry e cache de stage ativo

Deliverable: camada de runtime que carrega stage ativo do storage, compila `worldLayout` e fornece snapshot ao game hub.

Requirement IDs:

- `REQ-SMR-003`
- `REQ-SMR-004`
- `REQ-SMR-005`

Arquivos provaveis:

- `server/internal/httpserver/stage_registry.go`
- `server/internal/httpserver/ws.go`
- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/server.go`

Done when:

- startup tenta carregar stage ativo do Postgres;
- fallback por arquivo continua funcional quando banco/config nao tiver stage ativo;
- publicacao recompila e troca o layout em cache de forma controlada;
- nao ha leitura de JSON do banco/filesystem a cada conexao.

### `TASK-SMR-04` Endpoints admin de catalogo

Deliverable: API admin para listar stages, ver detalhes, importar JSON, validar e exportar versao.

Requirement IDs:

- `REQ-SMR-001`
- `REQ-SMR-002`
- `REQ-SMR-007`
- `REQ-SMR-008`
- `REQ-SMR-014`

Endpoints sugeridos:

- `GET /admin/stages`
- `GET /admin/stages/{stageId}`
- `POST /admin/stages/import`
- `POST /admin/stage-versions/{versionId}/validate`
- `GET /admin/stage-versions/{versionId}/export`

Done when:

- importacao de JSON valido cria stage ou nova versao;
- importacao de JSON invalido retorna `400` com erros;
- listagem inclui status, versao, checksum e datas;
- exportacao retorna o JSON da versao;
- testes HTTP cobrem fluxo feliz e erro.

### `TASK-SMR-05` Publicacao, ativacao e rollback

Deliverable: endpoints e regras para publicar versao, definir stage ativo e voltar versao anterior.

Requirement IDs:

- `REQ-SMR-004`
- `REQ-SMR-006`
- `REQ-SMR-013`
- `REQ-SMR-015`

Endpoints sugeridos:

- `POST /admin/stage-versions/{versionId}/publish`
- `POST /admin/stage-versions/{versionId}/activate`
- `POST /admin/stages/{stageId}/archive`
- `POST /admin/stages/{stageId}/rollback`

Done when:

- somente versao valida pode ser publicada/ativada;
- ativacao atualiza `game_config.activeStageVersionId`;
- rollback escolhe versao publicada anterior e recompila cache;
- stage arquivado nao pode virar ativo sem desarquivamento futuro explicito;
- eventos principais registram auditoria minima.

### `TASK-SMR-06` UI `/admin/stages`

Deliverable: tela administrativa para operar catalogo e versoes de stages.

Requirement IDs:

- `REQ-SMR-007`
- `REQ-SMR-008`
- `REQ-SMR-013`
- `REQ-SMR-014`

Arquivos provaveis:

- `client/src/App.tsx`
- `client/src/components/AdminLayout/index.tsx`
- `client/src/components/StageManager/index.tsx`
- `client/src/components/StageManager/StageManager.module.css`
- `client/src/hooks/useAdminStages.ts`

Done when:

- `/admin/stages` aparece no menu admin;
- admin ve tabela com stages, status e versoes;
- admin importa JSON por textarea/upload;
- erros de validacao aparecem na UI;
- acoes de exportar, publicar, ativar, rollback e arquivar refletem permissao/status;
- `pnpm --dir client typecheck` passa.

### `TASK-SMR-07` Integrar Map Builder Pro com importacao direta

Deliverable: o builder deixa de depender apenas de download manual e oferece envio direto para o catalogo de stages.

Requirement IDs:

- `REQ-SMR-001`
- `REQ-SMR-002`
- `REQ-SMR-007`

Arquivos provaveis:

- `client/src/components/MapBuilder/index.tsx`
- `client/src/components/MapBuilder/HeaderControls.tsx`
- `client/src/components/MapBuilder/exportStage.ts`
- `client/src/hooks/useAdminStages.ts`

Done when:

- header do builder tem acao `Salvar no admin` ou `Enviar para stages`;
- payload enviado e o mesmo exportado em JSON;
- sucesso mostra stage/version criado;
- erro de validacao mostra feedback acionavel;
- download JSON continua disponivel.

### `TASK-SMR-08` Preparar `stageRuntime`

Deliverable: refactor backend para encapsular estado runtime por stage, mantendo comportamento atual com um stage padrao.

Requirement IDs:

- `REQ-SMR-009`
- `REQ-SMR-010`
- `REQ-SMR-011`
- `REQ-SMR-012`

Arquivos provaveis:

- `server/internal/httpserver/ws.go`
- `server/internal/httpserver/ws_world.go`
- `server/internal/httpserver/ws_player.go`
- `server/internal/httpserver/world_runtime.go`
- `server/internal/httpserver/stage_runtime.go`

Done when:

- existe tipo `stageRuntime` com layout, players, flowers, hives e collections;
- o hub usa o runtime padrao para preservar comportamento atual;
- funcoes de movimento, coleta e broadcast recebem ou resolvem runtime por jogador;
- testes garantem que estado nao fica acoplado diretamente a um unico mundo global.

### `TASK-SMR-09` Restart e fallback operacional

Deliverable: boot confiavel que restaura stage ativo do banco e usa arquivo apenas como fallback.

Requirement IDs:

- `REQ-SMR-005`
- `REQ-SMR-011`

Arquivos provaveis:

- `server/internal/config/config.go`
- `server/internal/httpserver/stage_registry.go`
- `README.md`
- `docker-compose.yml`

Done when:

- servidor inicia com stage ativo do banco quando configurado;
- se storage estiver vazio, usa `server/maps/map.json`;
- logs deixam claro qual origem foi usada;
- README explica fluxo de fallback.

### `TASK-SMR-10` Documentar fluxo e performance

Deliverable: documentacao operacional curta para criacao, validacao, publicacao e rollback de stages.

Requirement IDs:

- `REQ-SMR-003`
- `REQ-SMR-004`
- `REQ-SMR-015`

Arquivos provaveis:

- `README.md`
- `AGENTS.md`
- `.specs/features/stage-management-runtime/spec.md`
- `.specs/features/stage-management-runtime/tasks.md`

Done when:

- docs explicam que deploy nao e necessario para publicar stage;
- docs indicam que JSON e compilado/cacheado na publicacao;
- docs descrevem MVP single-active-stage e caminho futuro multi-map;
- guardrail alerta contra parse de JSON no loop de jogo.

## Ordem recomendada

1. `TASK-SMR-01` e `TASK-SMR-02`.
2. `TASK-SMR-03` para ativar o carregamento performatico.
3. `TASK-SMR-04` e `TASK-SMR-05` para API admin.
4. `TASK-SMR-06` e `TASK-SMR-07` para UX admin/builder.
5. `TASK-SMR-08` quando for preparar multi-map no runtime.
6. `TASK-SMR-09` e `TASK-SMR-10` para fechamento operacional.

## Riscos

- Trocar stage ativo com players conectados pode gerar inconsistencia se nao houver politica clara de reconexao/teleporte.
- Persistir JSON grande no banco exige limites de tamanho e compressao futura se crescer demais.
- Refatorar `gameHub` para multi-map cedo demais pode aumentar escopo; manter MVP com runtime padrao reduz risco.
- Sem validacao forte, um stage ruim pode quebrar o loop de jogo.
- Sem cache, carregar JSON em requests frequentes pode degradar performance.
