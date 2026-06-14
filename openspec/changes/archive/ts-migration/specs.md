# Specs: Frontend TypeScript Migration

## Requirements
- **FR1**: Vite must compile TypeScript (`.ts` and `.tsx`) natively.
- **FR2**: Core domain interfaces (`Player`, `ChatMessage`) must be explicitly defined and exported.
- **FR3**: The application must run without regression.

## Technical Details
- **Dependencies**: `npm install -D typescript @types/react @types/react-dom`.
- **Config**: Standard `tsconfig.json` extending Vite types.
- **File Renames**:
  - `client/src/main.jsx` -> `client/src/main.tsx`
  - `client/src/App.jsx` -> `client/src/App.tsx`
  - `client/src/views/DMView.jsx` -> `client/src/views/DMView.tsx`
  - `client/src/views/PlayerView.jsx` -> `client/src/views/PlayerView.tsx`
  - `client/src/components/PluginSlot.jsx` -> `client/src/components/PluginSlot.tsx`
- **index.html**: `<script type="module" src="/src/main.tsx"></script>`
