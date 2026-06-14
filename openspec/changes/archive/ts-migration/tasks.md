# Tasks: Frontend TypeScript Migration

## Phase 1: Setup & Configuration
- [x] Run `npm install -D typescript @types/react @types/react-dom` in `client/`.
- [x] Create `client/tsconfig.json` and `client/tsconfig.node.json`.
- [x] Create `client/src/vite-env.d.ts`.

## Phase 2: Renaming & HTML
- [x] Update `client/index.html` `src` to `/src/main.tsx`.
- [x] Rename `main.jsx` to `main.tsx`.
- [x] Rename `App.jsx` to `App.tsx`.
- [x] Rename `views/DMView.jsx` to `views/DMView.tsx`.
- [x] Rename `views/PlayerView.jsx` to `views/PlayerView.tsx`.
- [x] Rename `components/PluginSlot.jsx` to `components/PluginSlot.tsx`.

## Phase 3: Types & Fixes
- [x] Add basic types in `DMView.tsx` and `PlayerView.tsx` to fix immediate TypeScript compiler errors.
- [x] Ensure `useRef`, `useState` and events have appropriate standard React types.

## Phase 4: Verification
- [x] Run `npm run build` and ensure there are no compilation errors.
