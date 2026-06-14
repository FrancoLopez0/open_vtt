# Proposal: Frontend TypeScript Migration

## Problem Statement
The current React frontend is written in JavaScript (`.jsx`). As the application grows in complexity (specifically, state management for DM Dashboard, Player Cards, Character Sheets, and WebSockets), relying on implicit types makes the code fragile, hard to refactor, and prone to runtime errors.

## Exploration
Vite has first-class support for TypeScript out of the box. We can easily migrate our codebase by installing TS dependencies, adding standard `tsconfig` files, and renaming `.jsx` files to `.tsx`.

## Proposed Architecture
- Install `typescript`, `@types/react`, and `@types/react-dom`.
- Add `tsconfig.json`, `tsconfig.node.json`, and `vite-env.d.ts` following Vite's standard React-TS template.
- Define core domain interfaces (e.g., `Player`, `ChatMessage`) to provide compile-time safety.
- Rename all `.js/.jsx` files in `client/src` to `.ts/.tsx`.
- Update `index.html` entry point.

## Risks & Trade-offs
- Risk: Potential build breakages due to untyped third-party dependencies or strict TS errors.
- Mitigation: Start with a pragmatic `tsconfig` (e.g., allow implicit `any` where needed initially) so we aren't blocked by pedantic errors while migrating existing logic.
