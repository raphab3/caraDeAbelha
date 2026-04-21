# Frontend standards

Use this repository's React + TypeScript frontend architecture as the default for any new frontend code.

- Prefer React 18+ with TypeScript in strict mode.
- For new projects, prefer `Tailwind CSS + shadcn/ui + Radix` as the default UI and styling stack.
- Organize code with `pages/` orchestrating route screens and `modules/` containing domain logic.
- Keep reusable cross-domain code in `shared/`, third-party setup in `lib/`, provider composition in `providers/`, and typed env access in `config/`.
- Treat pages as composition layers only. Business rules, API integration, and module-specific state belong in `modules/`.
- Keep component logic and styles in separate files. For greenfield work with Tailwind, keep class composition out of large route files by extracting reusable UI components and constants. For existing code, detect the styling solution already used in the project or module before adding new styles.
- For net-new user-facing screens, admin panels, dashboards, or major visual changes, do not jump straight to code. First define a concrete visual direction: focal area, hierarchy, density, accent usage, responsive behavior, and how loading/empty/error states will look.
- Reuse product tokens and shared primitives, but do not default to stacks of generic cards, badges, and explanatory copy. New surfaces should have a clear primary region, a supporting region, and enough contrast in scale or layout to avoid looking like placeholder admin UI.
- Before finalizing user-facing frontend work, run a copy pass on titles, subtitles, empty states, errors, and CTAs. Use the `Writer` agent when the text starts sounding internal, technical, or operational.
- For net-new or materially redesigned frontend surfaces, consult the `ui-ux-pro-max` skill for layout, typography, color, and interaction guidance before implementation.
- If styled-components is used, theme values are the single source of truth for colors, spacing, typography, shadows, radii, and breakpoints.
- If the project uses `Tailwind CSS + shadcn/ui + Radix`, prefer shadcn primitives first, extend them in `shared/components/`, and keep tokens centralized through the Tailwind theme and CSS variables.
- Use React Hook Form with Zod for forms, TanStack React Query for server state, Zustand for global state with actions, and Jotai for simple shared atomic UI state.
- Reevaluate every `useEffect`. Prefer React Query, derived state, event handlers, atoms, or local initial state when possible.
- Avoid hardcoded design tokens, large monolithic components, and unnecessary state duplication.
- New `.tsx` files must stay well below the hard limit of 800 lines. Components should usually stay near 150 lines and be split when responsibilities grow.
- Use strong domain typing. Prefer `interface` for domain objects and component props, `type` for unions and utility compositions, `DTO` suffixes for API payloads, and `Props` suffixes for React props.
- Use the `@/` import alias for `src/` when the project is configured for it.
- When editing existing code that does not follow these conventions, inspect the local pattern first and ask before doing structural refactors beyond the requested change.

Detailed frontend guidance lives in:

- [.github/instructions/frontend/react-architecture.instructions.md](./instructions/frontend/react-architecture.instructions.md)
- [.github/instructions/frontend/react-data-and-state.instructions.md](./instructions/frontend/react-data-and-state.instructions.md)
- [.github/instructions/frontend/react-existing-code.instructions.md](./instructions/frontend/react-existing-code.instructions.md)
- [.github/skills/react-frontend-architecture/SKILL.md](./skills/react-frontend-architecture/SKILL.md)