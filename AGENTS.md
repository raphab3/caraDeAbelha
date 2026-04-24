# Repository Guidelines

## Project Structure & Module Organization

- `server/`: Go service. Entrypoint is `server/cmd/server/main.go`; domain logic lives under `server/internal/gameplay/`; WebSocket and HTTP behavior lives under `server/internal/httpserver/`.
- `server/maps/map.json`: world map, zones, and transitions. Database migrations are in `server/internal/dbmigrate/`.
- `client/`: Vite React app. Source is in `client/src/`, static assets in `client/public/`, and dev assets in `client/dev-dist/`.
- `client/src/game/`: WebSocket client, gameplay environment, and HUD components. `client/src/components/` contains UI and editor features.
- `infra/postgres/` and `docker-compose.yml`: local Postgres and container orchestration.

## Build, Test, and Development Commands

- `make up`: build and start backend, frontend, and Postgres with Docker Compose.
- `make down`: stop the Docker Compose stack.
- `make server`: run the Go server locally from `server/`.
- `make server-test`: run all backend tests with `go test ./...`.
- `make setup-client`: install frontend dependencies with `pnpm install`.
- `make client`: start the Vite dev server.
- `make client-build`: run TypeScript checks and build production assets.
- `make build`: run backend tests and frontend build.

For client-only checks, run `cd client && pnpm run typecheck`.

## Coding Style & Naming Conventions

Go code should follow `gofmt`. Keep server behavior authoritative: validate gameplay actions in the backend before mutating state or broadcasting updates.

TypeScript uses strict mode. Use `PascalCase` for React components, `camelCase` for functions, variables, props, and JSON protocol fields, and descriptive hook names such as `useGameSession`.

New or refactored visual components should use local `*.module.css` files. Keep `client/src/styles.css` for Tailwind import, global reset/base rules, tokens, and shared styles. Example: `LoginGate/index.tsx` imports `LoginGate.module.css`; use Tailwind only for small one-off utilities, not full component layouts.

## Testing Guidelines

Backend tests use Go's standard testing framework and live beside implementation files as `*_test.go`. Prefer focused tests for gameplay, zones, WebSocket messages, and world runtime changes. Run `make server-test` before opening a PR.

The frontend currently relies on TypeScript and build validation. Run `cd client && pnpm run typecheck` after changing React, hooks, or shared types.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, sometimes with Conventional Commit prefixes: `feat: standardize docker-compose commands` and `Improve map builder usability`.

Pull requests should include a concise summary, test results (`make build`, `make server-test`, or relevant client checks), linked issues when applicable, and screenshots or short recordings for UI changes.

## Security & Configuration Tips

Do not commit local secrets. Copy environment files from documented examples when available, and keep LAN-specific values such as `LAN_HOST` local to your machine.
