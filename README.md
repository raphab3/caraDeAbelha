# Cara de Abelha - MMORPG Foundation

Um jogo multiplayer 3D construído em Go (backend) e React + Three.js (frontend). Implementação de um loop de progressão (coletar, depositar, desbloquear) com suporte a múltiplas zonas e economia de recursos.

## 📊 Status do Projeto

**Progresso Geral: 17/49 tasks (35%)**

### ✅ Completadas

- **Epic 1 - Collection Loop** (9/9 tasks) ✅
  - Modelo de progressão de jogadores (pollen, honey, XP, zonas)
  - Sistema de coleta de flores com validação
  - Sistema de depósito de mel (10 pollen = 1 honey)
  - Mensagens WebSocket bidireccionais
  - Componentes HUD (ResourceRibbon, ObjectivePanel, InteractionFeed)
  - Testes backend: 62+ testes passando

- **Epic 2 - Zone Economy System** (8/8 tasks) ✅
  - Modelo de zonas com custos e pré-requisitos
  - Sistema de unlock de zonas usando mel como moeda
  - Validação server-side de acesso a zonas
  - Portões visuais de zonas
  - Feedback HUD para unlock
  - Testes de validação completos

### ⏳ Em Desenvolvimento / Pendentes

- **Epic 3 - UI Framework & Settings** (8 tasks) - Próximo
- **Epic 4 - Equipment & Loadouts** (7 tasks)
- **Epic 5 - Skill Tree & Progression** (10 tasks)
- **Epic 6 - PvP Arena & Guilds** (9 tasks)

## 🏗️ Arquitetura

### Backend (Go)
```
server/
├── internal/
│   ├── gameplay/
│   │   ├── loopbase/        # Collection mechanics (flowers, hives, pollen, honey)
│   │   └── zones/           # Zone unlock system with honey costs
│   └── httpserver/
│       ├── ws.go            # WebSocket hub and routing
│       ├── ws_player.go     # Player-specific handlers (collection, deposit, zone unlock)
│       ├── ws_messages.go   # Protocol definitions (camelCase JSON)
│       └── world_map.go     # World layout and zone management
└── maps/
    └── map.json             # Zone definitions and transitions
```

**Princípios:**
- Server-authoritative: toda lógica de negócios no backend
- Validação de ações antes de aplicar state
- Broadcast de state apenas quando há mudanças
- WebSocket com mensagens em camelCase JSON

### Frontend (TypeScript/React)
```
client/src/
├── components/
│   ├── GameViewport/
│   │   ├── ZoneGateRenderer.tsx    # Portões visuais de zonas
│   │   ├── FlowerRenderer.tsx      # Renderizador de flores
│   │   ├── HiveRenderer.tsx        # Renderizador de colmeias
│   │   └── InstancedWorldField.tsx # Composição principal
│   └── PlayerExperience/
│       └── index.tsx               # Orquestrador de experiência
├── game/hud/
│   ├── GameHUD.tsx                 # Composição de HUD
│   ├── ResourceRibbon.tsx          # Display de pollen/honey/XP
│   ├── ObjectivePanel.tsx          # Objetivos atuais
│   ├── InteractionFeed.tsx         # Feedback de ações
│   └── ZoneUnlockPanel.tsx         # Info de unlock de zonas
├── hooks/
│   └── useGameSession.ts           # Orquestração de sessão
└── types/
    └── game.ts                     # Tipos da aplicação (ClientMessage, ZoneState, etc)
```

**Stack:**
- React 18+ com TypeScript strict mode
- Three.js com renderização instanced
- React Router para navegação
- React Query para estado do servidor
- CSS Modules por componente + tokens globais para UI nova e refactors
- Tailwind CSS apenas como apoio pontual em protótipos ou utilitários pequenos
- Vite para build

### Diretriz de CSS

Daqui para frente, componentes novos ou refatorados devem usar CSS componentizado:

- Cada componente visual com estilo relevante deve ter um arquivo local `*.module.css` ao lado do `index.tsx` ou do arquivo do componente.
- `client/src/styles.css` deve ficar restrito a `@import "tailwindcss"`, reset/base global, tokens CSS, cursores globais e regras realmente transversais.
- Evitar strings longas de classes em `className`. Quando a composição passar de utilitários simples, mover para CSS Module.
- Não adicionar novos blocos BEM grandes em CSS global para componentes específicos.
- Estados visuais devem ser expressos por props ou estado interno do componente, mapeando para classes locais do módulo.
- Tokens como cores, sombras, raios, z-index, espaçamento e motion devem ser centralizados antes de serem reutilizados por vários componentes.
- Bibliotecas CSS-in-JS com runtime, como `styled-components` ou `emotion`, não devem ser adotadas sem nova decisão técnica, porque o jogo já tem carga pesada de Three.js e deve evitar custo de runtime desnecessário.

## 🚀 Rodando o Projeto

### Requisitos

- Go 1.22+
- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

### Comandos

```bash
# Setup inicial
cp .env.example .env

# Subir tudo (backend + frontend + postgres)
make up

# Em outro terminal - dev server frontend
cd client && npm run dev

# Testes backend
make server-test
# ou
cd server && go test ./... -v

# Build frontend
cd client && npm run build

# Validações
make build
docker compose config
docker compose ps
```

**Acesso:**
- Frontend: http://localhost:3001 (dev) / http://localhost:3000 (prod)
- Backend: http://localhost:8080
- Health check: http://localhost:8080/healthz

## 🗺️ Gerenciamento de Stages

Stages criados no Map Builder Pro podem ser enviados para o admin sem substituir `server/maps/map.json`:

- Acesse `/admin/builder` e use `Salvar no admin` para importar o JSON gerado.
- Acesse `/admin/stages` para listar, publicar, ativar, exportar, arquivar ou fazer rollback.
- Com `DATABASE_URL` configurado, o Postgres guarda metadados das versoes; o JSON do mapa fica em `STAGE_STORAGE_DIR` (`/app/data/stages` no Docker Compose).
- Arquivos `*.json` em `server/maps` sao detectados na subida do servidor e importados como seed automaticamente, evitando cadastro manual apos um build/deploy com mapas novos.
- Sem banco configurado, o servidor usa um store em memoria para desenvolvimento e continua caindo no fallback `server/maps/map.json` no restart.
- O JSON e validado e compilado para `worldLayout` na importacao/publicacao; o loop de jogo usa o layout ativo cacheado em memoria.
- Na primeira subida apos a migracao, o servidor move `source_json` legado do banco para arquivos e remove a coluna pesada de `stage_versions`.

O MVP mantém um stage ativo global, mas o backend ja carrega `stageId` e prepara `stageRuntime` para evoluir para jogadores em mapas diferentes.

## 🌐 Testar em Rede Local

1. Descubra o IP: `hostname -I` ou `ip addr`
2. Edite `LAN_HOST` no `.env` (ex: `192.168.0.25`)
3. Recrie com URLs corretas: `make down && make up`
4. Acesse de outro computador: `http://IP_DA_MAQUINA:3000`
5. Libere portas 3000 e 8080 no firewall se necessário

**Nota:** O client precisa apontar para o IP do host. Localhost não funcionará entre computadores.

## 📋 Protocol WebSocket

### Client → Server
```json
{
  "type": "move",
  "dir": "up"
}

{
  "type": "move_to",
  "x": 100,
  "z": 200
}

{
  "type": "collect_flower",
  "nodeId": "flower_123"
}

{
  "type": "deposit_honey"
}

{
  "type": "unlock_zone",
  "zoneId": "zone_1"
}

{
  "type": "respawn"
}
```

### Server → Client
```json
{
  "type": "state",
  "tick": 1000,
  "players": [...],
  "chunks": [...]
}

{
  "type": "player_status",
  "playerId": "p1",
  "pollenCarried": 50,
  "honey": 10,
  "level": 5,
  "xp": 1200,
  "unlockedZoneIds": ["zone_0", "zone_1"]
}

{
  "type": "interaction_result",
  "action": "collect_flower",
  "success": true,
  "value": 10,
  "reason": "Collected pollen successfully"
}

{
  "type": "zone_state",
  "zones": [...],
  "unlockedZoneIds": ["zone_0"]
}
```

## 🏆 Game Mechanics

### Collection Loop (Epic 1) ✅
1. **Coleta**: Player clica em flor → ganha pollen (10 por flor)
2. **Depósito**: Player clica em colmeia → converte pollen em honey (10 pollen = 1 honey)
3. **Progresso**: Honey exibido em HUD, usado como moeda

### Zone Economy (Epic 2) ✅
1. **Zonas**: 5 zonas (zone_0 a zone_4) com pré-requisitos lineares
2. **Custos**: Cada unlock custa mel (zone_0: free, zone_1: 5, zone_2: 10, etc)
3. **Acesso**: Server valida se player tem mel suficiente e pré-requisito
4. **Feedback**: Portões visuais mostram zonas locked/unlocked

### XP & Leveling (Epic 3+)
- Coleta de flores ganha XP
- Levels desbloqueiam skills e equipment
- Skill tree com escolhas de progressão

## 📈 Estatísticas

- **Testes Backend**: 62+ testes passando (collection, zones, protocol)
- **Builds**: Frontend zero errors (TypeScript strict), Backend build OK
- **Entidades**: ~1000 flores + colmeias renderizadas com instancing
- **Players**: Até 20+ simultâneos suportados
- **Protocol**: ~50 msgs/sec quando todos em movimento

## 🔗 Documentação Adicional

- `VALIDATION_REPORT_EPIC1.md` - Relatório completo de validação Epic 1
- `EPIC1_VALIDATION_SUMMARY.txt` - Sumário executivo
- `EPIC1_ACTION_ITEMS.md` - Plano de implementação
- `.specs/` - Especificações de features em desenvolvimento

## 🛠️ Desenvolvimento

### Estrutura de Tasks

O projeto usa um padrão TLC (Test-List-Code) com 49 tasks planejadas:
- 9 tasks Epic 1 (✅ Complete)
- 8 tasks Epic 2 (✅ Complete)
- 8 tasks Epic 3 (⏳ Pending)
- 7 tasks Epic 4 (⏳ Pending)
- 10 tasks Epic 5 (⏳ Pending)
- 7 tasks Epic 6 (⏳ Pending)

### Próximos Passos

1. **Epic 3**: Framework de UI (settings, profiles, social)
2. **Epic 4**: Sistema de equipment (slots, stats, loadouts)
3. **Epic 5**: Skill tree (atributos, talentos, progressão)
4. **Epic 6**: PvP e Guilds (arenas, conquistas, cooperação)

## 📝 Notas Importantes

- **Server-Authoritative**: Nunca confie em dados do client
- **Pollen Capacity**: Limitado a prevenir exploits de storage
- **Zone Prerequisites**: Imposto no server, validado em cada unlock
- **Instancing**: Flores e colmeias usam THREE.js InstancedMesh para performance

## 🔄 Git Workflow

```bash
# Verificar histórico
git log --oneline -10

# Ver mudanças recentes
git show HEAD

# Status
git status
```

**Últimos commits:**
- Epic 1 integration complete
- Epic 2 zone economy system
- Client-server collection flow

Para instalar as dependencias do client fora do Docker, use `make setup-client` ou rode `cd client && pnpm install`.

## Proxima fase sugerida

Extrair o estado do jogo para um pacote dedicado no backend e adicionar identificacao explicita do jogador local para HUD, camera e futuras mecanicas.
