# Design: Open VTT — Initial Scaffold

## Technical Approach

Greenfield implementation. Backend-first: Python kernel boots FastAPI + Uvicorn in a daemon thread, then blocks on pywebview. Frontend is a standalone Vite/React SPA that the built `dist/` makes static-servable. Plugins are loaded at Python startup, their JS assets served as static files, and consumed by the frontend via a REST call + dynamic `<script>` injection.

## Architecture Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Uvicorn threading | `threading.Thread(daemon=True)` | `asyncio.create_task`, subprocess | Daemon thread auto-dies with main process; simpler than subprocess IPC |
| Host token delivery | URL query param injected by pywebview | Env var, file, IPC | pywebview can construct the URL; no IPC channel needed |
| Player token type | `uuid.uuid4()` string | Short codes, numeric pins | UUID has negligible collision risk; no external dependency |
| LAN IP detection | `socket.gethostbyname(socket.gethostname())` | `netifaces` lib, hardcoded | Zero-dependency; sufficient for home LAN |
| Plugin JS serving | FastAPI `StaticFiles` mount per plugin | CDN, bundled into dist | Runtime-loaded plugins need their own URL namespace |
| Frontend WS URL | `window.location.host` at runtime | Hardcoded, env var | Works in both pywebview (localhost) and browser (LAN IP) automatically |

## Data Flow

```
Startup
  main.py
    ├── kernel.py → scans plugins/ → pluggy.PluginManager
    ├── ws_manager.py → ConnectionManager (token registry)
    ├── FastAPI app
    │     ├── GET /api/plugins  → kernel.get_plugin_metadata()
    │     ├── POST /api/players → ws_manager.register_player()
    │     ├── GET /api/players  → ws_manager.list_players()
    │     ├── WS /ws/host       → ws_manager.connect_host()
    │     ├── WS /ws/player     → ws_manager.connect_player()
    │     ├── StaticFiles /     → client/dist/
    │     └── StaticFiles /plugins/{name}/ → plugins/{name}/
    └── pywebview.create_window("http://localhost:8000/dm?token=<host_token>")

Runtime WebSocket message flow
  DM action → WS /ws/host → ConnectionManager.broadcast_public() → all sockets
  Secret roll → WS /ws/host → ConnectionManager.send_to_host() → host WS only
  Player action → WS /ws/player → ConnectionManager.broadcast_public() → all sockets
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/requirements.txt` | Create | fastapi, uvicorn[standard], pywebview, pluggy, websockets |
| `server/hookspecs.py` | Create | `OpenVTTSpec` with `on_session_start`, `on_dice_roll`, `on_chat_message` |
| `server/ws_manager.py` | Create | `ConnectionManager` + `PlayerInfo` dataclass |
| `server/kernel.py` | Create | `Kernel` class — plugin scanner + pluggy manager |
| `server/main.py` | Create | FastAPI app + all routes + Uvicorn thread + pywebview |
| `client/package.json` | Create | React 18, react-dom, react-router-dom, vite, @vitejs/plugin-react |
| `client/vite.config.js` | Create | React plugin + proxy `/api` and `/ws` → localhost:8000 |
| `client/index.html` | Create | Vite entry HTML |
| `client/src/main.jsx` | Create | ReactDOM.createRoot entry point |
| `client/src/App.jsx` | Create | BrowserRouter + Routes (`/dm`, `/player`, `/` redirect) |
| `client/src/App.css` | Create | Dark fantasy base styles |
| `client/src/views/DMView.jsx` | Create | Host WS, Player Manager panel, PluginSlot[dm] |
| `client/src/views/PlayerView.jsx` | Create | Player WS, error state, PluginSlot[player] |
| `client/src/components/PluginSlot.jsx` | Create | Fetches /api/plugins, injects scripts, renders custom elements |
| `plugins/example_plugin/__init__.py` | Create | `ExamplePlugin` class with `@hookimpl on_dice_roll` |
| `plugins/example_plugin/plugin.json` | Create | name, version, description metadata |
| `plugins/example_plugin/dm_widget.js` | Create | `<example-plugin-dm>` custom element — dice roller with secret toggle |
| `plugins/example_plugin/player_widget.js` | Create | `<example-plugin-player>` custom element — simplified dice roller |
| `README.md` | Create | Setup, run dev, run prod, plugin authoring guide |
| `openspec/config.yaml` | Create | SDD config (already created) |
| `.gitignore` | Create | `__pycache__/`, `dist/`, `node_modules/`, `.atl/` |

## Interfaces / Contracts

```python
# ws_manager.py
@dataclass
class PlayerInfo:
    name: str
    connected: bool
    websocket: WebSocket | None = None

class ConnectionManager:
    host_token: str
    host_connection: WebSocket | None
    players: dict[str, PlayerInfo]  # token → PlayerInfo

    async def connect_host(self, ws: WebSocket, token: str) -> bool: ...
    async def connect_player(self, ws: WebSocket, token: str) -> bool: ...
    async def disconnect(self, ws: WebSocket) -> None: ...
    async def broadcast_public(self, message: dict) -> None: ...
    async def send_to_host(self, message: dict) -> None: ...
    async def send_to_player(self, token: str, message: dict) -> None: ...
    def register_player(self, name: str) -> str: ...  # returns token
```

```typescript
// Plugin metadata shape (from GET /api/plugins)
interface PluginMeta {
  name: string;
  version: string;
  description: string;
  dm_widget: string | null;    // URL path e.g. /plugins/example_plugin/dm_widget.js
  player_widget: string | null;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Token validation logic in ConnectionManager | Manual test script (no test framework yet) |
| Integration | WS handshake accept/reject | Manual: use `wscat` or browser devtools |
| E2E | DM window opens + player browser connects | Manual: run `main.py`, open browser on second device |

## Migration / Rollout

No migration required. Greenfield — no existing data or users.

## Open Questions

- [ ] Should `GET /api/players` tokens be redacted in the response, or is full token visibility acceptable for a local LAN app?
