# Cara de Abelha

Base inicial do projeto para estudar Go e React Three Fiber construindo um jogo multiplayer em fases.

## O que ja esta pronto

- backend Go com servidor HTTP minimo e healthcheck em `/healthz`
- client Vite + React + Three.js com uma cena 3D inicial para validar o ambiente
- rota `/ws` com estado autoritativo minimo de jogadores e broadcast de movimento
- input por teclado no client enviando intencoes `move` para o servidor
- PostgreSQL via Docker Compose com schema inicial
- Makefile com comandos de desenvolvimento mais comuns

## Requisitos

- Go 1.22+
- Node.js 20+
- Docker + Docker Compose

## Subir o ambiente

```bash
cp .env.example .env
make up
```

Depois abra `http://localhost:3000`.

## Validacoes uteis

```bash
make server-test
make client-build
docker compose config
docker compose ps
```

## Proxima fase sugerida

Extrair o estado do jogo para um pacote dedicado no backend e adicionar identificacao explicita do jogador local para HUD, camera e futuras mecanicas.