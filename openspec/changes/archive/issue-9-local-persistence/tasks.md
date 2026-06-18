# Tasks: Persistencia Local (Issue #9)

- `[x]` Backend: Create `server/store.py`
  - `[x]` Implement JSON file I/O for `players.json` and `combat.json` in `.data` dir
- `[x]` Backend: Update `server/ws_manager.py`
  - `[x]` Load players from store on startup
  - `[x]` Save players to store on registration
- `[x]` Backend: Update `server/main.py` (Host WebSocket)
  - `[x]` Send `combat_init` to DM on connection
  - `[x]` Handle `combat_update` event to save combat state
- `[x]` Frontend: Update `client/src/views/DMView.tsx`
  - `[x]` Catch `combat_init` in websocket handler and store in React state
  - `[x]` Pass `initialCombatState` as prop to `CombatEngine`
- `[x]` Frontend: Update `client/src/components/CombatEngine.tsx`
  - `[x]` Initialize state from `initialCombatState` prop
  - `[x]` Dispatch `send-ws` with `combat_update` on any relevant state change
