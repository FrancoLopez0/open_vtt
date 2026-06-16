# Tasks: Core RPG Plugin & Architecture Upgrade

## Phase 1: Architecture Upgrade (Backend)
- [x] Add `on_plugin_message` to `server/hookspecs.py`.
- [x] Implement a `send_plugin_message(target, plugin_name, payload)` method in `ws_manager.py`.
- [x] Inject the `send_plugin_message` callback into the `Kernel` during startup in `server/main.py`.
- [x] Update `ws_player` and `ws_host` in `server/main.py` to intercept `plugin_message` and call `kernel.fire("on_plugin_message", ...)`.

## Phase 2: Architecture Upgrade (Frontend)
- [x] Update `DMView.jsx` and `PlayerView.jsx` to listen for a `send-ws` custom DOM event and send it through the WebSocket.
- [x] Update `DMView.jsx` and `PlayerView.jsx` to intercept incoming `plugin_message` events and dispatch them as `plugin-message` custom DOM events to the `window`.

## Phase 3: Core RPG Plugin
- [x] Create `plugins/core_rpg/plugin.json` and `plugins/core_rpg/__init__.py`.
- [x] Implement sheet storage and `on_plugin_message` logic in `__init__.py`.
- [x] Create `plugins/core_rpg/player_widget.js` with the Character Sheet UI and save/load logic.
- [x] Create `plugins/core_rpg/dm_widget.js` to list all player sheets.

## Phase 4: Verification
- [ ] Launch server.
- [ ] Open DM view, add player, open player view.
- [ ] Edit stats on player sheet and save.
- [ ] Verify DM can see the updated sheet.
