# Tasks: Open VTT — Initial Scaffold

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650–850 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Backend (server/) → PR 2: Frontend (client/) → PR 3: Plugin + Docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Python backend: kernel, WS manager, hookspecs, main.py | PR 1 → targets `feature/open-vtt-scaffold` | Foundation; no frontend dep |
| 2 | React frontend: routing, DMView, PlayerView, PluginSlot | PR 2 → targets PR 1 branch | Depends on PR 1 API contract |
| 3 | Example plugin + README + .gitignore | PR 3 → targets PR 2 branch | Depends on PR 1 (hookspecs) + PR 2 (custom elements) |
| tracker | Merge `feature/open-vtt-scaffold` → `main` | Final merge | After all 3 PRs are merged into tracker |

---

## Phase 1: Python Foundation

- [x] 1.1 Create `server/requirements.txt` with: `fastapi`, `uvicorn[standard]`, `pywebview`, `pluggy`, `websockets`
- [x] 1.2 Create `server/hookspecs.py` — define `OpenVTTSpec` class with `@hookspec` for `on_session_start(session)`, `on_dice_roll(roller, result, secret)`, `on_chat_message(sender, message)`
- [x] 1.3 Create `server/ws_manager.py` — `PlayerInfo` dataclass + `ConnectionManager` class with all methods per design interface contract
- [x] 1.4 Create `server/kernel.py` — `Kernel` class: scans `../plugins/`, loads `__init__.py` via `importlib`, registers with pluggy, exposes `fire()` and `get_plugin_metadata()`
- [x] 1.5 Create `server/main.py` — FastAPI app with: static mount for `../client/dist/`, per-plugin static mounts under `/plugins/{name}/`, all REST endpoints (`/api/plugins`, `POST /api/players`, `GET /api/players`), both WS endpoints (`/ws/host`, `/ws/player`), Uvicorn daemon thread, pywebview window creation

## Phase 2: React Frontend

- [x] 2.1 Create `client/package.json` with deps: `react@18`, `react-dom@18`, `react-router-dom@6` + devDeps: `vite`, `@vitejs/plugin-react`
- [x] 2.2 Create `client/vite.config.js` — React plugin + dev server proxy: `/api` and `/ws` → `http://localhost:8000` with `ws: true`
- [x] 2.3 Create `client/index.html` — minimal Vite entry HTML with `<div id="root">` and script tag for `src/main.jsx`
- [x] 2.4 Create `client/src/main.jsx` — `ReactDOM.createRoot(document.getElementById('root')).render(<App />)`
- [x] 2.5 Create `client/src/App.jsx` — `BrowserRouter` with routes: `/dm` → `DMView`, `/player` → `PlayerView`, `/` → `<Navigate to="/player" />`
- [x] 2.6 Create `client/src/App.css` — dark fantasy base styles: CSS variables, dark background (`#0d0d0f`), gold accent (`#b38135`), base typography
- [x] 2.7 Create `client/src/components/PluginSlot.jsx` — `useEffect` fetches `/api/plugins`, filters by `role` prop (`dm_widget` or `player_widget`), injects `<script>` tags once, renders custom element tags via `useRef` + `innerHTML`
- [x] 2.8 Create `client/src/views/DMView.jsx` — reads `?token` from `useSearchParams`, opens WS to `/ws/host?token=`, shows connection status + player manager panel (calls `POST /api/players`, displays join URL) + `<PluginSlot role="dm" />`
- [x] 2.9 Create `client/src/views/PlayerView.jsx` — reads `?token` from `useSearchParams`, opens WS to `/ws/player?token=`, handles close code 4001 with error screen, shows `<PluginSlot role="player" />`

## Phase 3: Example Plugin

- [ ] 3.1 Create `plugins/example_plugin/plugin.json` — `{"name": "example_plugin", "version": "0.1.0", "description": "Demo dice roller"}`
- [ ] 3.2 Create `plugins/example_plugin/__init__.py` — `ExamplePlugin` class with `@hookimpl def on_dice_roll(self, roller, result, secret)` that logs the roll
- [ ] 3.3 Create `plugins/example_plugin/dm_widget.js` — `ExamplePluginDM extends HTMLElement` with shadow DOM: d4/d6/d8/d10/d12/d20 buttons, secret roll toggle checkbox, result display; registers as `example-plugin-dm`
- [ ] 3.4 Create `plugins/example_plugin/player_widget.js` — `ExamplePluginPlayer extends HTMLElement` with shadow DOM: same dice buttons without secret toggle; registers as `example-plugin-player`

## Phase 4: Wiring & Integration

- [ ] 4.1 Create `.gitignore` — `__pycache__/`, `*.pyc`, `dist/`, `node_modules/`, `.atl/`, `*.egg-info/`
- [ ] 4.2 Verify `kernel.py` resolves `plugins/` path relative to `main.py` location using `pathlib.Path(__file__).parent.parent / "plugins"` — not CWD
- [ ] 4.3 Verify `main.py` resolves `client/dist/` path using `pathlib.Path(__file__).parent.parent / "client" / "dist"` — not CWD
- [ ] 4.4 Verify WS endpoints send `{"type": "error", "code": 4001}` before closing — frontend relies on close code for error display
- [ ] 4.5 Verify `PluginSlot` de-duplicates script injection — re-mounting the component must not load the same script twice

## Phase 5: Documentation

- [ ] 5.1 Create `README.md` with sections: Project overview, Prerequisites (Python 3.11+, Node 18+), Dev setup, Dev run, Production run, Plugin authoring guide (file structure + hookspecs + Web Component naming convention)
