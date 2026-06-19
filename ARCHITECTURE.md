# Open VTT — Architecture

## Core Principle: Everything is a Plugin

> **"Todo es un plugin."**

The native application provides only infrastructure. **All game mechanics, UI widgets, and data formats are owned by plugins.** If a feature can be moved to a plugin, it must be.

### What the native app provides
| Concern | Responsibility |
|---------|---------------|
| WebSocket server | Connection management, auth, message routing |
| Plugin kernel | Discovery, loading, hookspec dispatch |
| `PluginSlot` component | Mount point for `player_widget` and `dm_widget` |
| Player registry | Token-based player list, persistence |
| Combat state | Save/restore only (no game logic) |
| Chat | Raw broadcast (no game logic) |

### What plugins own
| Concern | Owner |
|---------|-------|
| Character sheet schema | `core_rpg` (or replacement plugin) |
| HP / mana / conditions | `core_rpg` |
| Sheet UI (player side) | `player_widget.js` |
| Sheet UI (DM side) | `dm_widget.js` |
| All game rules | plugins |

---

## Plugin Contract

Every plugin is a directory under `plugins/` with:
- `__init__.py` — Python module exposing a `plugin` instance
- `plugin.json` — Metadata (`name`, `version`, `description`)
- `player_widget.js` _(optional)_ — Custom element for the player view
- `dm_widget.js` _(optional)_ — Custom element for the DM view

### Hookspecs (server-side)

| Hook | When fired |
|------|-----------|
| `on_session_start(session)` | Server startup |
| `on_player_connect(token, name)` | Player WS connects |
| `on_player_disconnect(token, name)` | Player WS drops |
| `on_plugin_message(sender, plugin, payload)` | Any `plugin_message` WS frame |
| `on_chat_message(sender, message)` | Any chat line |
| `on_dice_roll(roller, result, secret)` | Any dice roll |

### Client event bus

| Event | Direction | Payload |
|-------|-----------|---------|
| `send-ws` | widget → host | Any WS frame dict |
| `plugin-message` | host → widget | `{ plugin, payload }` |
| `vtt-players-update` | host → widget | `Player[]` |

---

## Data Flow: HP change

```
DM widget: click "−5"
  → CustomEvent('send-ws') { type: 'plugin_message', plugin: 'core_rpg', payload: { action: 'adjust_hp', target_player: token, delta: -5 } }
  → DMView WS → server
  → core_rpg.on_plugin_message → mutates sheet → _save_sheets()
  → kernel.send_message("ALL", "core_rpg", { action: 'sheet_updated', player: token, sheet: {...} })
  → ws_manager.broadcast_public
      ↓ host WS                        ↓ player WS
  DMView: 'plugin_message' event     PlayerView: 'plugin_message' event
    → plugin-message custom event        → plugin-message custom event
    → dm_widget re-renders HP bar        → player_widget._updateDOM() HP bar
    → playerSheets[token] updated
    → CombatEngine live HP updated
```

---

## Restoring Player State on Reload

1. Player loads `/player?token=<token>` → React app starts
2. WS connects → server fires `on_player_connect(token, name)` hook
3. `core_rpg.on_player_connect` pushes stored `sheet_data` to player WS
4. `player_widget._msgHandler` receives `sheet_data` → calls `_updateDOM()`
5. Player sees their sheet immediately, no user action needed

---

## Adding a New Plugin

1. Create `plugins/my_plugin/__init__.py` with a `plugin` instance implementing any hooks
2. Create `plugins/my_plugin/plugin.json` with `name`, `version`, `description`
3. Optionally add `player_widget.js` and/or `dm_widget.js` as Custom Elements
4. Restart the server — the kernel auto-discovers and loads it

No native code changes required.
