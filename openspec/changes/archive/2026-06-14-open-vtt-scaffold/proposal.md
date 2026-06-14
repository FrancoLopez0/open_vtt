# Proposal: Open VTT — Initial Scaffold

## Intent

Bootstrap the complete project structure for a local-network D&D VTT. No code exists yet. This change delivers all foundation files needed to run the DM desktop window and allow players to connect via browser on the same LAN.

## Scope

### In Scope

- `server/` — FastAPI microkernel with pluggy, WebSocket manager, plugin loader, pywebview launcher
- `client/` — Vite + React SPA with `/dm` and `/player` routes, PluginSlot component
- `plugins/example_plugin/` — Demo plugin with dual Web Components (DM + Player)
- `openspec/` — SDD artifact store (this change)
- `README.md` — Setup and run instructions

### Out of Scope

- PyInstaller packaging (future change)
- Real character sheet data model (future change)
- Persistent game state / database (future change)
- Authentication hardening beyond token-based WS validation (future change)

## Capabilities

### New Capabilities

- `microkernel-server`: FastAPI server with pluggy event bus, plugin loader, WebSocket manager, and pywebview launcher
- `websocket-auth`: Token-based WebSocket authentication — host token (DM) and per-player UUID tokens
- `player-manager`: DM REST API to create players, generate tokens, and return shareable join URLs
- `frontend-routing`: React SPA with isolated `/dm` and `/player` routes and a PluginSlot component
- `plugin-system`: Runtime plugin loading from `plugins/` directory with dual Web Component support

### Modified Capabilities

None — greenfield project.

## Approach

Create all files from scratch following the approved implementation plan. Backend first (server/), then frontend scaffold (client/), then example plugin, then docs. No framework generators — hand-crafted to keep dependencies minimal and the structure transparent.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/main.py` | New | FastAPI app, Uvicorn thread, pywebview window |
| `server/ws_manager.py` | New | Host + player WS pools, token registry |
| `server/kernel.py` | New | Pluggy manager, importlib plugin loader |
| `server/hookspecs.py` | New | Hook spec definitions |
| `server/requirements.txt` | New | Python dependencies |
| `client/src/` | New | React app, DMView, PlayerView, PluginSlot |
| `client/package.json` | New | Node dependencies |
| `plugins/example_plugin/` | New | Demo plugin — hookimpl + 2 Web Components |
| `README.md` | New | Dev setup and run instructions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| pywebview + Uvicorn thread conflict on Windows | Medium | Use daemon thread for Uvicorn; test startup sequence |
| Vite dev proxy misconfiguration breaks WS in dev | Low | Explicit `ws: true` in vite proxy config |
| Plugin importlib path resolution fails | Low | Normalize plugin path with `pathlib.Path` |

## Rollback Plan

Delete all created files. Git repo is empty — `git reset --hard HEAD` or delete the workspace. No migrations, no external side effects.

## Dependencies

- Python 3.11+ with pip
- Node.js 18+ with npm

## Success Criteria

- [ ] `python server/main.py` starts Uvicorn on `0.0.0.0:8000` and opens a pywebview window at `/dm`
- [ ] A browser hitting `http://<local-ip>:8000/player?token=<token>` loads the player view
- [ ] Creating a player via `POST /api/players` returns a valid join URL
- [ ] A WebSocket connection without a valid token is rejected with close code 4001
- [ ] Example plugin widgets render in both DM and Player views
- [ ] `npm run build` in `client/` produces a `dist/` that FastAPI serves correctly
