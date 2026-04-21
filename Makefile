SHELL := /bin/bash

.PHONY: up down db-up db-down infra-up infra-down logs server server-test client client-build setup-client

up:
	docker compose up --build -d --force-recreate --remove-orphans

down:
	docker compose down

db-up:
	docker compose up -d db

db-down:
	docker compose stop db

infra-up:
	docker compose up --build -d --force-recreate server db

infra-down:
	docker compose down

logs:
	docker compose logs -f db server client

server:
	cd server && go run ./cmd/server

server-test:
	cd server && go test ./...

setup-client:
	cd client && npm install

client:
	cd client && npm run dev

client-build:
	cd client && npm run build