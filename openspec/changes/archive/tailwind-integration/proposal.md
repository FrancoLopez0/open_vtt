# SDD Proposal: Tailwind Integration

## Problem Statement
The frontend requires a modern styling solution to ensure consistency, speed up UI development, and maintain responsiveness. The user has requested Tailwind CSS.

## Exploration
Given the user's choice, we will use **Tailwind v4**, which is the latest version. Tailwind v4 introduces a new CSS-first configuration model, removing the need for `tailwind.config.js`. It integrates directly with Vite via the `@tailwindcss/vite` plugin.

### Key constraints:
- Existing UI should not break. Tailwind utility classes should coexist with current vanilla CSS.
- Frontend build process (`npm run build`) must continue to work flawlessly.

## Proposed Architecture
- **Dependencies**: `@tailwindcss/vite` and `tailwindcss`.
- **Vite Configuration**: Add `tailwindcss()` to the `plugins` array in `client/vite.config.js`.
- **Global Styles**: Inject `@import "tailwindcss";` at the top of `client/src/index.css`.
- **Proof of Concept**: Add simple Tailwind utility classes to `DMView.jsx` to verify the pipeline is working.

## Risks & Trade-offs
- **Risk**: Tailwind might conflict with some existing vanilla CSS classes if there are naming collisions.
- **Mitigation**: Existing custom CSS uses semantic naming (`player-list`, `btn-primary`), which rarely collides with Tailwind's utility-first naming (`text-red-500`, `flex`). We will monitor for any unexpected visual changes.
