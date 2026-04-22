# 📚 Documentation Map

Guia para encontrar informação no projeto.

## 🎯 Começar

**Novo no projeto?** Comece aqui:
1. [README.md](./README.md) - Overview, como rodar
2. [PROJECT_STATUS.md](./PROJECT_STATUS.md) - O que foi feito
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - Como funciona

## 📄 Documentos Disponíveis

### Uso e Setup

| Documento | Conteúdo | Para Quem |
|-----------|----------|-----------|
| [README.md](./README.md) | Como rodar, requisitos, network testing | Devs iniciando |
| [.env.example](./.env.example) | Variáveis de ambiente | Ops/Deployment |
| [docker-compose.yml](./docker-compose.yml) | Infraestrutura containerizada | DevOps |
| [Makefile](./Makefile) | Comandos comuns | Todos |

### Progresso e Status

| Documento | Conteúdo | Para Quem |
|-----------|----------|-----------|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Progresso por epic, métricas | PMs, Leads |
| [VALIDATION_REPORT_EPIC1.md](./VALIDATION_REPORT_EPIC1.md) | Validação detalhada Epic 1 | QA, Leads |
| [EPIC1_VALIDATION_SUMMARY.txt](./EPIC1_VALIDATION_SUMMARY.txt) | Sumário rápido Epic 1 | QA |
| [EPIC1_ACTION_ITEMS.md](./EPIC1_ACTION_ITEMS.md) | Plano de implementação Epic 1 | Implementadores |

### Arquitetura e Design

| Documento | Conteúdo | Para Quem |
|-----------|----------|-----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Diagrama sistema, data flow, design patterns | Arquitetos, Leads |
| [TASK_CDAM_01_06_IMPLEMENTATION.md](./TASK_CDAM_01_06_IMPLEMENTATION.md) | Especificação task CDAM-01-06 | Devs frontend |
| [.specs/features/](./.specs/features/) | Especificações de features em TLC | Todos |

## 🗂️ Por Tópico

### Começar Desenvolvimento

1. Faça clone: `git clone <repo>`
2. Setup: `cp .env.example .env && make up`
3. Abra: http://localhost:3001
4. Leia: [README.md](./README.md)

### Backend Development

**Arquivos chave:**
- `server/internal/gameplay/loopbase/service.go` - Collection logic
- `server/internal/gameplay/zones/service.go` - Zone unlock logic
- `server/internal/httpserver/ws_player.go` - Action handlers
- `server/internal/httpserver/ws_messages.go` - Protocol definitions

**Documentação:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Backend stack, security model
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Epic descriptions

**Testes:**
```bash
cd server && go test ./... -v
```

### Frontend Development

**Arquivos chave:**
- `client/src/hooks/useGameSession.ts` - State management
- `client/src/components/GameViewport/` - 3D rendering
- `client/src/game/hud/` - UI components
- `client/src/types/game.ts` - Protocol types

**Documentação:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Frontend stack, component architecture
- [TASK_CDAM_01_06_IMPLEMENTATION.md](./TASK_CDAM_01_06_IMPLEMENTATION.md) - UI implementation example

**Build:**
```bash
cd client && npm run build
```

### Game Design & Balancing

**Documentação:**
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Game mechanics section
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Configuration section
- [EPIC1_ACTION_ITEMS.md](./EPIC1_ACTION_ITEMS.md) - Design decisions

**Balancing constants:**
```go
// server/internal/httpserver/ws_player.go
pollenPerFlower := 10
pollenToHoneyRatio := 10
zone1Honey := 5
zone2Honey := 10
// ...
```

### Testing & Validation

**Documentação:**
- [VALIDATION_REPORT_EPIC1.md](./VALIDATION_REPORT_EPIC1.md) - Full Epic 1 tests
- [EPIC1_VALIDATION_SUMMARY.txt](./EPIC1_VALIDATION_SUMMARY.txt) - Quick summary

**Comandos:**
```bash
# Backend tests
cd server && go test ./... -v

# Frontend build/type check
cd client && npm run build

# Quick validation
make build
```

### Deployment & Operations

**Documentação:**
- [README.md](./README.md) - Network testing section
- [.env.example](./.env.example) - Configuration

**Commands:**
```bash
make up              # Start everything
make down            # Stop everything
make logs           # See logs
docker compose ps   # Check status
```

## 🔍 Encontrar Algo Específico

### "Como funciona coleta de pollen?"
1. [ARCHITECTURE.md](./ARCHITECTURE.md) → Data Flow → Collection Action
2. `server/internal/gameplay/loopbase/service.go` → CollectFlowerPollen()
3. Tests: `server/internal/gameplay/loopbase/service_test.go`

### "Como adiciono uma nova zona?"
1. [ARCHITECTURE.md](./ARCHITECTURE.md) → Configuration
2. Edit: `server/maps/map.json` → zones array
3. Update: `server/internal/gameplay/zones/models.go` → ZoneState
4. Add tests

### "Como funciona o unlock de zonas?"
1. [PROJECT_STATUS.md](./PROJECT_STATUS.md) → Epic 2 → Zone Structure
2. [ARCHITECTURE.md](./ARCHITECTURE.md) → Security Model
3. `server/internal/gameplay/zones/service.go` → UnlockZone()

### "Como funciona a renderização?"
1. [ARCHITECTURE.md](./ARCHITECTURE.md) → Frontend → InstancedWorldField
2. `client/src/components/GameViewport/` → InstancedWorldField.tsx
3. `client/src/components/GameViewport/` → FlowerRenderer.tsx

### "Qual é a próxima tarefa?"
1. [PROJECT_STATUS.md](./PROJECT_STATUS.md) → Epic 3-6 sections
2. `.specs/features/` → Design specification

## 📊 Quick Stats

| Métrica | Valor | Arquivo |
|---------|-------|---------|
| Progresso | 17/49 (35%) | PROJECT_STATUS.md |
| Backend Tests | 62+ passing | PROJECT_STATUS.md |
| Frontend Build | Zero errors | PROJECT_STATUS.md |
| Zones | 5 (zone_0 → zone_4) | ARCHITECTURE.md |
| Pollen:Honey | 10:1 | ARCHITECTURE.md |
| Players | 20+ concurrent | PROJECT_STATUS.md |

## 🔗 External References

### Go
- [Go 1.22 Docs](https://pkg.go.dev)
- [Gorilla WebSocket](https://github.com/gorilla/websocket)

### React/Three.js
- [React 18 Docs](https://react.dev)
- [Three.js Docs](https://threejs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

## 📝 Convenções

### Commit Messages

```
feat: Adiciona coleta de pollen
fix: Corrige validação de zona
docs: Atualiza README
test: Adiciona testes de depósito
chore: Atualiza dependências
```

### File Naming

- Go: snake_case (`ws_player.go`)
- TypeScript: PascalCase files for components (`GameViewport.tsx`)
- Tests: `*_test.go` or `*.spec.ts`

### Branch Naming

```
feature/epic-1-collection-loop
bugfix/zone-unlock-validation
docs/update-architecture
```

## ❓ FAQ

**P: Onde começo se quero adicionar uma feature?**
A: 1. Leia [ARCHITECTURE.md](./ARCHITECTURE.md), 2. Veja task em [PROJECT_STATUS.md](./PROJECT_STATUS.md), 3. Procure similar em código

**P: Como testo muda local?**
A: `make build` then `make up` then open http://localhost:3001

**P: Como vejo histórico de mudanças?**
A: `git log --oneline -20` ou `git show <commit>`

**P: Cadê os testes?**
A: `server/**/*_test.go` para backend, `client/src/**/*.spec.ts` para frontend

**P: Como reporto um bug?**
A: Create issue with: reprodução steps, expected vs actual, environment

## 📚 Leitura Recomendada

**Ordem de leitura para novos devs:**

1. **30 min**: [README.md](./README.md) + `make up`
2. **1h**: [PROJECT_STATUS.md](./PROJECT_STATUS.md) Epic 1-2
3. **2h**: [ARCHITECTURE.md](./ARCHITECTURE.md) Backend section
4. **2h**: [ARCHITECTURE.md](./ARCHITECTURE.md) Frontend section
5. **2h**: Code reading (`server/internal/gameplay/loopbase/`)
6. **2h**: Code reading (`client/src/hooks/useGameSession.ts`)

Total: ~9h para entender completamente o sistema.

---

**Última atualização**: 21 de Abril de 2026
