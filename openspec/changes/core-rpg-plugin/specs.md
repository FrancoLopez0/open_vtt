# Specs: Core RPG Plugin & Architecture Upgrade

## Overview
Expand the microkernel architecture to support bidirectional custom WebSocket messages between plugins and clients, and implement a foundational `core_rpg` plugin for managing generic character sheets.

## Requirements

### Architecture Upgrade (Kernel & WebSockets)
- **FR1**: `hookspecs.py` must include `@hookspec def on_plugin_message(sender: str, plugin: str, payload: dict)`.
- **FR2**: The `Kernel` class must inject or provide a callback mechanism (e.g. `kernel.send_message = manager.send_plugin_message`) so plugins can send data back to clients.
- **FR3**: `server/main.py` WebSocket endpoints must intercept `{"type": "plugin_message", "plugin": "...", "payload": {...}}` and fire the `on_plugin_message` hook.
- **FR4**: `client/src/views/PlayerView.jsx` and `DMView.jsx` must intercept a DOM custom event (e.g. `send-ws`) emitted by plugin widgets and route it through the active WebSocket connection.
- **FR5**: Incoming `plugin_message` events from the server must be dispatched to the DOM so plugin widgets can listen to them (e.g. via `window.dispatchEvent(new CustomEvent('plugin-message', ...))`).

### Core RPG Plugin
- **FR6**: `plugins/core_rpg/__init__.py` must store character sheets in memory and handle `get_sheet` and `save_sheet` plugin messages.
- **FR7**: `plugins/core_rpg/player_widget.js` must render a generic character sheet UI (Name, HP, dynamic stats list, inventory notes).
- **FR8**: `plugins/core_rpg/dm_widget.js` must render a DM view listing all active character sheets.
- **FR9**: Plugin UI must use vanilla CSS (in Shadow DOM) matching the dark fantasy aesthetic.

## Out of Scope
- Database persistence (sheets will be kept in memory for now).
- Complex drag-and-drop inventory mechanics or automated stat calculations.
