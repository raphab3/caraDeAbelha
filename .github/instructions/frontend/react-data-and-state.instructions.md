---
name: React data and state rules
description: Rules for forms, server state, local state, Zustand, Jotai, Axios, and useEffect reduction in React frontends.
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# React data and state rules

- Use the flow `component -> query hook -> service -> Axios instance -> API` for server data.
- Keep services framework-agnostic and free of React imports.
- Centralize query keys per domain and colocate React Query hooks in `modules/<domain>/queries/`.
- Use TanStack React Query for server state, cache, fetching states, invalidation, and mutations.
- Use React Hook Form with Zod for forms. Put form schemas in `schema.ts` and infer form types with `z.infer`.
- Use local `useState` or `useReducer` for component-local UI state.
- Use Zustand when shared state also carries business actions or non-trivial update logic.
- Use Jotai for simple shared atomic UI state and favor derived atoms instead of effects for computed values.
- Avoid pulling entire Zustand stores in one call. Consume state via selectors.
- Reevaluate every `useEffect`. If it fetches data, computes derived values, syncs duplicate state, or reacts to events that already have handlers, replace it with a more declarative pattern.
- Prefer default form values, computed render values, React Query dependencies, or derived atoms over synchronization effects.
- Centralize the Axios instance in `src/lib/axios.ts` and the React Query client in `src/lib/queryClient.ts`.
- Compose global providers in `src/providers/index.tsx` instead of stacking them ad hoc in multiple entry points.