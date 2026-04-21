# 🐝 Cara de Abelha — Documento de Contexto do Projeto

> **Versão:** 1.0  
> **Status:** Em desenvolvimento  
> **Objetivo principal:** Aprender Go na prática construindo um jogo multiplayer realtime inspirado no "Beeface: Be a Bee!" do Roblox.

---

## 1. Visão Geral

**Cara de Abelha** é um jogo multiplayer 3D rodando no browser. O jogador controla uma abelha que coleta pólen de flores, converte em mel na colmeia e usa o mel para desbloquear novas áreas do mapa. Múltiplos jogadores compartilham o mesmo mundo em tempo real, enquanto a lógica autoritativa do servidor pode continuar simples em grid nas primeiras fases.

O projeto tem **dois objetivos simultâneos**:

1. **Produto:** um jogo web funcional, jogável e divertido
2. **Aprendizado:** dominar Go através de um projeto com concorrência real, WebSocket, estado distribuído e arquitetura de sistemas

---

## 2. Stack Tecnológica

### Backend — Go (servidor autoritativo)

| Tecnologia | Uso |
|---|---|
| Go 1.22+ | Linguagem principal do servidor |
| `gorilla/websocket` | Comunicação WebSocket com clientes |
| `net/http` | Servidor HTTP base |
| PostgreSQL + `pgx` | Persistência de jogadores, mel, ranking |
| `golang-jwt/jwt` | Autenticação por token |
| Docker | Containerização do servidor e banco |

### Frontend — React + Three.js (browser 3D)

| Tecnologia | Uso |
|---|---|
| React | Shell da aplicação, HUD e composição da UI |
| Three.js | Renderização 3D de baixo nível |
| React Three Fiber | Cena 3D declarativa integrada ao React |
| TypeScript | Tipagem do client |
| Vite | Build e dev server |
| WebSocket nativo | Conexão com servidor Go |

### Infraestrutura

| Tecnologia | Uso |
|---|---|
| Docker Compose | Orquestra servidor + banco local |
| PostgreSQL | Banco principal |
| Redis (fase futura) | Pub/sub para escala horizontal |

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│               BROWSER (React + Three.js)               │
│                                                         │
│  Input (WASD + mouse) → Envia intenção via WS           │
│  Recebe estado → Atualiza cena 3D + HUD                 │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket (JSON)
                       │ ↑ GameState  ↓ PlayerAction
┌──────────────────────▼──────────────────────────────────┐
│                  SERVIDOR (Go)                          │
│                                                         │
│  GameServer                                             │
│  ├── Game Loop (ticker 20ms) — fonte da verdade         │
│  ├── 1 goroutine por conexão (read/write loop)          │
│  ├── WorldState protegido por sync.RWMutex              │
│  ├── Channels: register / unregister / broadcast        │
│  ├── 1 goroutine por Abelha NPC (pathfinding BFS)       │
│  └── HTTP handlers: /ws, /login, /register              │
│                                                         │
│  Persistência                                           │
│  └── PostgreSQL (jogadores, mel, ranking, saves)        │
└─────────────────────────────────────────────────────────┘
```

### Princípio central

O servidor Go é **autoritativo** — nenhum cliente decide o estado do jogo. Clientes enviam *intenções* (`{"type":"move","dir":"up"}`), o servidor valida, atualiza o estado e transmite o resultado para todos os jogadores conectados.

---

## 4. Mecânicas do Jogo

### Loop principal

```
Coletar Pólen → Retornar à Colmeia → Converter em Mel → Desbloquear Área → Repeat
```

### Mecânicas detalhadas

| Mecânica | Descrição | Implementação Go |
|---|---|---|
| **Coleta de pólen** | Jogador fica sobre flor, acumula pólen ao longo do tempo | Ticker 20ms, struct `Flower` com capacidade e regeneração |
| **Colmeia** | Troca pólen por mel ao entrar em contato | Colisão server-side, transação no PostgreSQL |
| **Expansão de território** | Mel desbloqueia novas parcelas do mapa | Grid 2D no servidor, estado por jogador |
| **Abelhas trabalhadoras** | NPCs que coletam automaticamente | 1 goroutine por abelha, pathfinding BFS no grid |
| **Ovos e raridade** | Abrir ovo revela abelha de raridade aleatória | `crypto/rand`, tabela de probabilidade |
| **Ranking ao vivo** | Placar de mel total atualizado em tempo real | Broadcast a cada 5s, heap ordenado |

### Tipos de abelha (raridade)

| Raridade | Velocidade | Capacidade | Probabilidade |
|---|---|---|---|
| Common | 1x | 10 | 71% |
| Rare | 1.3x | 18 | 18% |
| Epic | 1.7x | 30 | 7.1% |
| Legendary | 2.5x | 50 | 3.3% |
| Surprise | Variável | Variável | 0.6% |

---

## 5. Estrutura do Projeto

```
cara-de-abelha/
│
├── server/                    # Go — backend autoritativo
│   ├── cmd/
│   │   └── server/
│   │       └── main.go        # Entrypoint
│   ├── internal/
│   │   ├── game/
│   │   │   ├── server.go      # GameServer struct + Run loop
│   │   │   ├── world.go       # WorldState, grid, flores
│   │   │   ├── player.go      # Player struct + actions
│   │   │   ├── bee.go         # Abelha NPC goroutine
│   │   │   ├── flower.go      # Flower struct + regeneração
│   │   │   └── physics.go     # Colisão server-side
│   │   ├── ws/
│   │   │   ├── handler.go     # HTTP → WS upgrade
│   │   │   └── client.go      # Client read/write goroutines
│   │   ├── auth/
│   │   │   └── jwt.go         # Login/register/JWT
│   │   └── db/
│   │       ├── postgres.go    # Conexão pgx
│   │       └── queries.go     # Save/load jogadores
│   ├── go.mod
│   └── Dockerfile
│
├── client/                    # React + Three.js — frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameViewport/
│   │   │   │   └── index.tsx  # Cena 3D inicial com React Three Fiber
│   │   │   └── StatusPanel/
│   │   │       └── index.tsx  # HUD e status do ambiente
│   │   ├── game/
│   │   │   ├── WSClient.ts    # WebSocket wrapper
│   │   │   └── env.ts         # Endpoints do ambiente local
│   │   ├── hooks/
│   │   │   └── useBackendHealth.ts # Ping do backend
│   │   ├── types/
│   │   │   └── game.ts        # Tipos compartilhados do client
│   │   ├── App.tsx            # Shell React do client
│   │   ├── main.tsx           # Bootstrap React
│   │   └── styles.css         # Layout, overlay e viewport
│   ├── public/
│   │   └── assets/            # Modelos, texturas e audio
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml         # Servidor + PostgreSQL
├── Makefile                   # make dev, make test, make build
└── CONTEXT.md                 # Este arquivo
```

---

## 6. Protocolo WebSocket

### Cliente → Servidor (ações do jogador)

```json
// Mover jogador
{ "type": "move", "dir": "up" | "down" | "left" | "right" }

// Coletar pólen manualmente (se implementado)
{ "type": "collect" }

// Abrir ovo
{ "type": "open_egg", "egg_id": "uuid" }

// Desbloquear parcela
{ "type": "unlock_tile", "x": 3, "y": 2 }
```

### Servidor → Cliente (estado do mundo)

```json
// Delta de estado a cada tick (20ms)
{
  "type": "state",
  "tick": 1042,
  "players": [
    { "id": "p1", "x": 120, "y": 80, "pollen": 45, "honey": 320 }
  ],
  "flowers": [
    { "id": "f1", "x": 200, "y": 150, "pollen": 80, "max_pollen": 100 }
  ],
  "bees": [
    { "id": "b1", "owner": "p1", "x": 210, "y": 145, "carrying": 12 }
  ]
}

// Evento de raridade (abertura de ovo)
{
  "type": "egg_result",
  "rarity": "legendary",
  "bee_id": "uuid",
  "stats": { "speed": 2.5, "capacity": 50 }
}

// Ranking (broadcast a cada 5s)
{
  "type": "ranking",
  "top": [
    { "name": "Rafa", "honey": 15420 },
    { "name": "Player2", "honey": 8930 }
  ]
}
```

---

## 7. Modelo de Dados (PostgreSQL)

```sql
-- Jogadores
CREATE TABLE players (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    honey       BIGINT DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Abelhas trabalhadoras do jogador
CREATE TABLE worker_bees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID REFERENCES players(id),
    rarity      VARCHAR(16) NOT NULL,  -- common, rare, epic, legendary
    speed       FLOAT NOT NULL,
    capacity    INT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Território desbloqueado por jogador
CREATE TABLE player_tiles (
    player_id   UUID REFERENCES players(id),
    x           INT NOT NULL,
    y           INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (player_id, x, y)
);
```

---

## 8. Conceitos Go Aplicados por Fase

| Fase | O que constrói | Conceitos Go |
|---|---|---|
| **1** | WebSocket + mover 1 ponto | `net/http`, `gorilla/websocket`, goroutines básicas |
| **2** | Múltiplos jogadores visíveis entre si | `sync.RWMutex`, `map[string]*Player`, broadcast channel |
| **3** | Flores, coleta, colmeia | Structs de domínio, ticker, colisão server-side |
| **4** | Login, persistência, ranking | `pgx`, JWT, PostgreSQL transactions |
| **5** | Abelhas NPC (goroutines) | Goroutine por NPC, BFS pathfinding, `sync.Pool` |
| **6** | Ovos, raridade, expansão | `crypto/rand`, geração procedural, eventos complexos |

---

## 9. Convenções de Desenvolvimento

### Go (servidor)

- **Erros explícitos:** sempre `if err != nil`, nunca panic em produção
- **Estado compartilhado:** sempre via `sync.RWMutex` ou channels — nunca variável global sem proteção
- **Goroutines:** toda goroutine precisa de mecanismo de cancelamento via `context.Context`
- **Nomenclatura:** `PascalCase` para tipos exportados, `camelCase` interno
- **Testes:** todo arquivo `*.go` de lógica tem `*_test.go` correspondente

### React Three Fiber / TypeScript (cliente)

- **Cliente não decide:** nunca modificar posição ou estado local sem confirmação do servidor
- **Cena 3D como apresentação:** o client pode renderizar em 3D, mas posição e estado continuam vindo do servidor
- **Interpolação:** aplicar suavização entre estados recebidos para evitar "teleport" visual
- **Separação:** `WSClient` só lida com WebSocket; `GameViewport` só renderiza; overlays React só exibem HUD e status

### Git

```
feat: adiciona mecânica de coleta de pólen
fix: corrige race condition no broadcast channel
refactor: extrai lógica de colisão para physics.go
docs: atualiza CONTEXT.md com protocolo WS
```

---

## 10. Como Rodar Localmente

```bash
# Clonar
git clone https://github.com/user/cara-de-abelha
cd cara-de-abelha

# Subir banco + servidor
docker-compose up -d

# Servidor Go (com hot-reload via air)
cd server
go run ./cmd/server

# Cliente React + Three Fiber
cd client
npm install
npm run dev

# Acessar
open http://localhost:3000
```

---

## 11. Próximos Passos Imediatos

- [x] Inicializar repositório e estrutura de pastas
- [x] Fase 1: servidor WebSocket básico em Go (`/ws` + broadcast de estado)
- [x] Fase 1: cliente React Three Fiber conectando e exibindo 1 abelha 3D se movendo
- [ ] Fase 1: confirmação visual de múltiplos jogadores na mesma sala
- [ ] Fase 2: extrair o estado do jogo para um pacote dedicado no backend
- [ ] Fase 2: identificar o jogador local na cena para camera e HUD

---

## Referências

- [go.dev/doc](https://go.dev/doc) — Documentação oficial Go
- [threejs.org/docs](https://threejs.org/docs/) — Documentação Three.js
- [docs.pmnd.rs/react-three-fiber/getting-started/introduction](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction) — Documentação React Three Fiber
- [gorilla/websocket](https://github.com/gorilla/websocket) — WebSocket em Go
- [Beeface: Be a Bee! (Roblox)](https://www.roblox.com/games/6410967163/Beeface) — Jogo de referência
- [100 Go Mistakes — Teien Bodner](https://100go.co) — Referência de boas práticas Go