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
# edite LAN_HOST no .env com o IP da maquina que esta rodando o Docker
make up
```

Depois abra `http://localhost:3000`.

## Testar em rede local

1. Descubra o IP da maquina que esta rodando o projeto com `hostname -I` ou `ip addr`.
2. Edite `LAN_HOST` no arquivo `.env` com esse IP, por exemplo `192.168.0.25`.
3. Rode `make down && make up` para recriar o client com as URLs corretas.
4. No outro computador da mesma rede Wi-Fi, abra `http://IP_DA_MAQUINA:3000`.
5. Se nao abrir, libere as portas `3000` e `8080` no firewall da maquina host.

Observacao:
O client precisa apontar para o IP da maquina host. Se ficar em `localhost`, o navegador do segundo computador vai tentar falar com ele mesmo, nao com o host do jogo.

## Validacoes uteis

```bash
make server-test
make client-build
docker compose config
docker compose ps
```

## Proxima fase sugerida

Extrair o estado do jogo para um pacote dedicado no backend e adicionar identificacao explicita do jogador local para HUD, camera e futuras mecanicas.