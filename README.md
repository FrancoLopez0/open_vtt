# Open VTT

Local-network Dungeon Master screen and player virtual tabletop for tabletop RPGs. Built on an asymmetric microkernel architecture where the DM runs a native desktop window and players connect via their browsers on the same WiFi network.

## Prerequisites

- Python 3.11+
- Node.js 18+

## Development Setup

1. **Install backend dependencies:**
   ```bash
   pip install -r server/requirements.txt
   ```

2. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   ```

## Running the Application

### Development Mode

Run the frontend dev server and backend API simultaneously:

1. In one terminal, start the Vite dev server:
   ```bash
   cd client
   npm run dev
   ```

2. In a second terminal, start the Python backend:
   ```bash
   python server/main.py
   ```

The DM window will open automatically.

### Production Mode

To run without the Vite dev server, build the frontend first:

```bash
cd client
npm run build
cd ..
python server/main.py
```

## Plugin Authoring

Plugins are auto-discovered from the `plugins/` directory. Each plugin must have:

- `plugin.json` (metadata)
- `__init__.py` (backend hooks)
- `dm_widget.js` (optional — DM UI component)
- `player_widget.js` (optional — Player UI component)

### Web Component Naming

Your custom elements **must** follow this exact naming convention based on your plugin folder name (converted from `snake_case` to `kebab-case`):

- `dm_widget.js` must register `<your-plugin-name-dm>`
- `player_widget.js` must register `<your-plugin-name-player>`

### Backend Hooks

Plugins can implement the following `pluggy` hooks (see `server/hookspecs.py`):
- `on_session_start(session)`
- `on_dice_roll(roller, result, secret)`
- `on_chat_message(sender, message)`
