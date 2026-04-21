---
name: NestJS backend architecture
description: Modular NestJS + Fastify + Drizzle backend architecture, validation, access control, and layering rules based on the Convrtfy backend.
applyTo: "backend/src/**/*.ts"
---

# NestJS backend architecture

- Default the backend stack to `NestJS + Fastify + TypeScript strict mode + Drizzle ORM + PostgreSQL + Zod` unless the user explicitly requests another foundation.
- Organize the backend under `src/modules/` for domain code and `src/shared/` for cross-cutting infrastructure. Keep `app.module.ts` as a composition root that wires modules and shared providers only.
- Each domain under `src/modules/<domain>/` should stay vertically sliced. Prefer `controllers/`, `services/`, `repositories/`, `schemas/`, and optional `types/` or `utils/` folders instead of mixing domain code into `shared/`.
- When a domain must expose repositories or access services to other domains, create a `<Domain>SharedModule` that exports only the providers meant for reuse. Import that shared module instead of reaching into another domain folder directly.
- Keep functional business modules project-scoped by default. New operational modules should usually expose routes under `projects/:projectId/<resource>` and store `projectId` as part of their core model unless the feature is truly workspace-wide or platform-wide.
- Keep controllers thin. Accept request bodies as `unknown`, validate them with Zod schemas from the module `schemas/` folder, read route params and authenticated user context, then delegate orchestration to a service.
- Prefer explicit schema files such as `<domain>.schemas.ts` that export both Zod schemas and inferred TypeScript types. Keep transport validation close to the module instead of scattering inline validation logic.
- Protect private routes with `AuthGuard` and read the authenticated user through `@CurrentUser()`. For public endpoints such as SDK/webhook ingestion, do not rely on auth guard shortcuts; validate token, origin, and payload explicitly inside the module flow.
- Centralize permission resolution in dedicated access services. Resolve project or workspace access first, then call explicit read/manage assertion methods before any repository access or mutation.
- Keep permission override rules in the access layer, not in controllers. Super-admin and workspace-owner exceptions should be encoded once in services such as `ProjectAccessService` or `<Domain>AccessService`.
- Split services by responsibility instead of building one large service per domain. Follow patterns already used in this backend such as `CrudService`, `AccessService`, `CalculationService`, `ResolutionService`, or explicit `UseCase` classes for more specific flows like authentication.
- Service classes should own business rules, cross-repository orchestration, permission checks, derived calculations, and response serialization. Repositories should not throw HTTP-specific exceptions or decide authorization.
- Keep repositories focused on Drizzle queries. Inject `DrizzleService`, accept typed repository inputs, return database rows or `null`, and avoid embedding controller concerns, permission logic, or business policy in repository methods.
- Convert database-specific representations at the service boundary. When Drizzle/Postgres returns numeric fields as strings, normalize them in serializers or dedicated mapping helpers before returning API responses.
- Keep database schema definitions centralized in `src/shared/database/schema/` and re-export them through a barrel file. Repositories should import tables from the shared schema barrel instead of duplicating schema wiring.
- Use the shared `DrizzleService` for database access. Do not create ad hoc database clients inside feature modules.
- Keep cross-cutting code inside `src/shared/`, especially `config/`, `database/`, `decorators/`, `filters/`, `guards/`, `providers/`, `types/`, and `utils/`. Avoid putting domain-specific behavior in those folders.
- Use the `@/` import alias for all imports under `src/` whenever possible. Preserve strict typing and avoid `any`; prefer dedicated interfaces, union types, and Zod inference.
- Keep bootstrap concerns in `main.ts`: global API prefix, CORS delegation through shared config helpers, and global exception filters. Do not duplicate application bootstrap behavior inside modules.
- Prefer explicit, predictable naming: `ProductsController`, `ProductsRepository`, `ProductCrudService`, `ProjectAccessService`, `project.schemas.ts`, and `<Domain>SharedModule`. Keep permission keys equally explicit, such as `project.products.read` and `project.products.manage`.
- Co-locate tests with the unit they validate using `*.spec.ts`. Prioritize service tests for business rules and permission branches, repository tests for data access behavior when needed, and controller tests for request validation or route contract behavior.
- When editing existing backend code, preserve the established vertical-slice module pattern. Do not introduce generic base services, abstract CRUD layers, or cross-domain shortcuts unless the repository already uses them consistently and the change explicitly requires it.

## Recommended module shape

```text
src/
  app.module.ts
  main.ts
  modules/
    <domain>/
      controllers/
      repositories/
      schemas/
      services/
      types/
      utils/
      <domain>.module.ts
      <domain>-shared.module.ts
  shared/
    config/
    database/
    decorators/
    filters/
    guards/
    providers/
    types/
    utils/
```

## Controller and service expectations

- Controllers should parse transport data and delegate immediately.
- Access checks should happen before reads and before writes.
- Mutation flows should assert writability explicitly, not implicitly.
- Services may serialize database rows into API-friendly objects.
- Repositories should stay reusable by other services without knowing about HTTP.