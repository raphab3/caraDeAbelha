SHELL := /bin/bash
COMPOSE ?= docker-compose

.PHONY: up down db-up db-down infra-up infra-down logs build server server-test client client-build setup-client

build: server-test client-build

up:
	$(COMPOSE) up -d --build --force-recreate --remove-orphans

down:
	$(COMPOSE) down

db-up:
	$(COMPOSE) up -d db

db-down:
	$(COMPOSE) stop db

infra-up:
	$(COMPOSE) up -d --build --force-recreate server db

infra-down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f db server client

server:
	cd server && go run ./cmd/server

server-test:
	cd server && go test ./...

setup-client:
	cd client && pnpm install

client:
	cd client && pnpm run dev

client-build:
	cd client && pnpm run build