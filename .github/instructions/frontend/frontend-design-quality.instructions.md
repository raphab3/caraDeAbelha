---
name: Frontend design quality guardrails
description: Guardrails for new user-facing screens, dashboards, admin panels, and meaningful visual changes in the frontend. Use when the task involves UI quality, hierarchy, layout, responsiveness, or visual polish.
applyTo: "frontend/src/**/*.{ts,tsx,css}"
---

# Frontend design quality guardrails

- For net-new screens, panels, dashboards, modals, or major visual changes, define a visual direction before writing code: primary focal area, supporting region, hierarchy, spacing rhythm, accent strategy, and responsive behavior.
- Reuse product tokens, layout primitives, and existing components, but do not default to `SurfaceCard` + `badge` + `preview-box` compositions for every new surface.
- Avoid placeholder side panels that only restate what the page already says. Supporting panels must add real decision-making value, shortcuts, or contextual data.
- Reduce explanatory prose. Prefer short headings, short helper text, and UI that communicates through hierarchy and grouping instead of paragraphs.
- When the surrounding module is visually weak, preserve the design language but improve the composition: stronger section titles, clearer grouping, better density control, and fewer decorative pills.
- Admin and backoffice surfaces should feel operational but intentional: crisp navigation, strong information hierarchy, restrained accent color, and at least one obvious focal region for the main task.
- Tables and dense views need an explicit mobile strategy. Do not let summary cards become the whole experience when the real job is search, editing, filtering, or reviewing data.
- Empty, loading, success, and error states must be concise and action-oriented. Avoid internal jargon, implementation details, or developer-facing explanations.
- When user-facing copy starts sounding internal or bureaucratic, run the `Writer` agent before finalizing.
- For materially new UI surfaces or redesigns, consult the `ui-ux-pro-max` skill before implementation and validate the result on desktop and mobile.