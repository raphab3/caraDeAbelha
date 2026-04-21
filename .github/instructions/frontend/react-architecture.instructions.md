---
name: React frontend architecture
description: Modular React + TypeScript architecture for pages, modules, shared code, styling, and naming.
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# React frontend architecture

- For new projects, default the UI layer to `Tailwind CSS + shadcn/ui + Radix` unless the user explicitly requests another stack.
- Structure frontend code around `pages/`, `modules/`, `shared/`, `lib/`, `providers/`, and `config/`.
- `pages/` only orchestrates route screens. It composes module components and should not hold heavy business logic.
- `modules/` contains domain-specific code, including `components/`, `types/`, `hooks/`, `services/`, `queries/`, and optional `stores/` or `atoms/`.
- `shared/` is reserved for reusable cross-module building blocks such as generic components, global hooks, shared stores, types, utils, and theme assets.
- Keep each component in its own folder with `index.tsx` and a separate style file. Add `types.ts` and `schema.ts` only when they are needed.
- In greenfield projects that use Tailwind, prefer `shared/components/ui/` for shadcn-based primitives and keep Radix-based accessibility behavior inside those reusable building blocks instead of duplicating it in pages.
- Prefer barrel exports like `types/index.ts` and `modules/<domain>/index.ts` for module boundaries.
- Keep naming predictable: component folders in PascalCase, pages as `PascalCasePage`, stores as `use<Domain>Store`, atoms as `<domain><Description>Atom`, services as `camelCaseService`, and React Query keys as `<entity>Keys`.
- Favor extraction over growth. If a component starts mixing layout, data orchestration, and behavior, split it into smaller components or hooks.
- Do not place styles in the same `.tsx` file as JSX. Use a sibling style file that matches the active styling approach.
- For Tailwind-based projects, extract long class compositions into reusable components, variants, or helpers instead of leaving large utility strings scattered across feature code.
- For styled-components, use transient props with a `$` prefix so style-only props do not leak to the DOM.
- Prefer the `@/` alias for imports under `src/` whenever the project supports it.
- When creating a new frontend area, mirror the module structure defined in [.github/skills/react-frontend-architecture/templates/module-structure.md](../../skills/react-frontend-architecture/templates/module-structure.md).