---
name: React existing code protocol
description: Protocol for changing existing frontend code that does not yet follow the desired architecture.
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# React existing code protocol

- Inspect the surrounding module before editing. Match the local framework, routing, styling, and file organization conventions that already exist.
- Detect the styling solution already in use before adding new UI code. If a module uses styled-components, continue with styled-components. If it uses Emotion, CSS Modules, SCSS, or Tailwind, stay consistent.
- For net-new screens, panels, or major user-facing sections, preserve tokens and reusable primitives but do not mechanically clone the weakest local composition. If the surrounding pattern is badge-heavy, text-heavy, or visually flat, establish clearer hierarchy while staying inside the product's design language.
- If you find existing code that violates the target architecture, ask before performing broader refactors beyond the requested change.
- Typical refactor triggers that require confirmation include mixed JSX and styles in the same file, manual API fetching in `useEffect`, oversized components, deep prop drilling, missing domain boundaries, or large inline type definitions.
- Safe micro-improvements can be made without asking when they are directly related to the requested change, such as replacing obvious `any` types, converting a normal import to `import type`, or tightening props types you already touch.
- Preserve behavior when extracting styles or splitting components unless the user explicitly requested a visual or behavioral change.
- If the codebase is already established and differs from the ideal layout, prefer incremental alignment instead of large rewrites.
- When you need to ask for permission, explain the concrete problem, the proposed refactor, and the low-risk option of keeping the current pattern for now.