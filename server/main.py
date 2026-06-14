"""
Open VTT — Entry point.

Starts the FastAPI server in a background daemon thread, then opens
a pywebview window for the DM. Players connect via browser on the LAN.

Usage:
    python server/main.py
"""

from __future__ import annotations

import logging
import secrets
import socket
import sys
import threading
import uuid
from pathlib import Path
from typing import Any

import uvicorn
import webview
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from kernel import Kernel
from ws_manager import ConnectionManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path resolution — always relative to this file, not CWD
# ---------------------------------------------------------------------------

SERVER_DIR = Path(__file__).parent
ROOT_DIR = SERVER_DIR.parent
CLIENT_DIST = ROOT_DIR / "client" / "dist"
PLUGINS_DIR = ROOT_DIR / "plugins"

# ---------------------------------------------------------------------------
# Token generation
# ---------------------------------------------------------------------------

HOST_TOKEN: str = secrets.token_urlsafe(32)

# ---------------------------------------------------------------------------
# LAN IP detection
# ---------------------------------------------------------------------------


def get_lan_ip() -> str:
    """Return the machine's LAN IP address (best-effort)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


LAN_IP: str = get_lan_ip()
PORT: int = 20800

# ---------------------------------------------------------------------------
# Firewall automation (Windows)
# ---------------------------------------------------------------------------

def ensure_firewall_rule(port: int) -> None:
    """Check and automatically add a Windows Firewall rule via UAC prompt."""
    if sys.platform != "win32":
        return

    import ctypes
    import subprocess

    rule_name = f"Open VTT (Port {port})"

    try:
        # Checking rule doesn't require admin privileges
        subprocess.check_output(
            f'netsh advfirewall firewall show rule name="{rule_name}"',
            shell=True,
            stderr=subprocess.STDOUT,
        )
        return  # Rule already exists, do nothing
    except subprocess.CalledProcessError:
        pass  # Rule not found, we must add it

    logger.info("Requesting Windows UAC elevation to configure firewall for LAN players...")

    # The 'runas' verb triggers the UAC prompt.
    # By specifying program=sys.executable, the rule only allows traffic when THIS Python is running.
    exe_path = sys.executable
    params = f'advfirewall firewall add rule name="{rule_name}" dir=in action=allow protocol=TCP localport={port} profile=any program="{exe_path}"'
    ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", "netsh", params, None, 0)

    if ret > 32:
        logger.info("Firewall rule configured successfully.")
    else:
        logger.warning("UAC prompt was rejected. Players on the LAN might not be able to connect.")


# ---------------------------------------------------------------------------
# Core services
# ---------------------------------------------------------------------------

kernel = Kernel(plugins_dir=PLUGINS_DIR)
manager = ConnectionManager(host_token=HOST_TOKEN)

# Inject the send method into the kernel so plugins can respond
kernel.send_message = manager.send_plugin_message

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(title="Open VTT", version="0.1.0")

# -- Static files -----------------------------------------------------------

if not CLIENT_DIST.is_dir():
    logger.warning(
        "Frontend dist not found at %s. Run 'npm run build' in client/ first.", CLIENT_DIST
    )

# Mount each plugin's static assets under /plugins/{plugin_name}/
for plugin_dir in sorted(PLUGINS_DIR.iterdir()) if PLUGINS_DIR.is_dir() else []:
    if plugin_dir.is_dir() and (plugin_dir / "__init__.py").exists():
        app.mount(
            f"/plugins/{plugin_dir.name}",
            StaticFiles(directory=str(plugin_dir)),
            name=f"plugin_{plugin_dir.name}",
        )

# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@app.get("/api/plugins")
async def get_plugins() -> JSONResponse:
    """Return metadata for all loaded plugins."""
    return JSONResponse(kernel.get_plugin_metadata())


class CreatePlayerRequest(BaseModel):
    name: str


@app.post("/api/players", status_code=201)
async def create_player(
    body: CreatePlayerRequest,
    x_host_token: str | None = Header(default=None),
) -> JSONResponse:
    """Create a new player and return their token and shareable join URL.

    Requires the DM's host token in the X-Host-Token header.
    """
    if x_host_token != HOST_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    player_token = str(uuid.uuid4())
    manager.register_player(name=body.name, token=player_token)

    join_url = f"http://{LAN_IP}:{PORT}/player?token={player_token}"
    return JSONResponse(
        {
            "name": body.name,
            "token": player_token,
            "join_url": join_url,
        }
    )


@app.get("/api/players")
async def list_players(
    x_host_token: str | None = Header(default=None),
) -> JSONResponse:
    """Return all registered players and their connection status.

    Requires the DM's host token in the X-Host-Token header.
    """
    if x_host_token != HOST_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    players = manager.list_players()
    for p in players:
        p["join_url"] = f"http://{LAN_IP}:{PORT}/player?token={p['token']}"
    return JSONResponse(players)


# ---------------------------------------------------------------------------
# WebSocket endpoints
# ---------------------------------------------------------------------------


@app.websocket("/ws/host")
async def ws_host(websocket: WebSocket, token: str = "") -> None:
    """WebSocket endpoint for the DM (host) connection."""
    accepted = await manager.connect_host(websocket, token)
    if not accepted:
        return

    try:
        await manager.broadcast_public({"type": "host_connected"})
        while True:
            data: dict[str, Any] = await websocket.receive_json()
            event_type = data.get("type", "")

            if event_type == "chat":
                await manager.broadcast_public(
                    {"type": "chat", "sender": "DM", "message": data.get("message", "")}
                )
                kernel.fire(
                    "on_chat_message", sender="DM", message=data.get("message", "")
                )

            elif event_type == "dice_roll":
                result = data.get("result", 0)
                secret = data.get("secret", False)
                kernel.fire("on_dice_roll", roller="DM", result=result, secret=secret)
                if secret:
                    await manager.send_to_host(
                        {"type": "dice_roll", "roller": "DM", "result": result, "secret": True}
                    )
                else:
                    await manager.broadcast_public(
                        {"type": "dice_roll", "roller": "DM", "result": result, "secret": False}
                    )

            elif event_type == "plugin_message":
                plugin_name = data.get("plugin", "")
                payload = data.get("payload", {})
                kernel.fire(
                    "on_plugin_message",
                    sender="DM",
                    plugin=plugin_name,
                    payload=payload,
                )

    except WebSocketDisconnect:
        await manager.disconnect(websocket)
        await manager.broadcast_public({"type": "host_disconnected"})


@app.websocket("/ws/player")
async def ws_player(websocket: WebSocket, token: str = "") -> None:
    """WebSocket endpoint for a player connection."""
    accepted = await manager.connect_player(websocket, token)
    if not accepted:
        return

    player_name = manager.players[token].name

    try:
        await websocket.send_json({"type": "welcome", "name": player_name})
        await manager.broadcast_public({"type": "player_connected", "name": player_name})
        while True:
            data: dict[str, Any] = await websocket.receive_json()
            event_type = data.get("type", "")

            if event_type == "chat":
                await manager.broadcast_public(
                    {
                        "type": "chat",
                        "sender": player_name,
                        "message": data.get("message", ""),
                    }
                )
                kernel.fire(
                    "on_chat_message",
                    sender=player_name,
                    message=data.get("message", ""),
                )

            elif event_type == "dice_roll":
                result = data.get("result", 0)
                kernel.fire("on_dice_roll", roller=player_name, result=result, secret=False)
                await manager.broadcast_public(
                    {
                        "type": "dice_roll",
                        "roller": player_name,
                        "result": result,
                        "secret": False,
                    }
                )

            elif event_type == "plugin_message":
                plugin_name = data.get("plugin", "")
                payload = data.get("payload", {})
                kernel.fire(
                    "on_plugin_message",
                    sender=player_name,
                    plugin=plugin_name,
                    payload=payload,
                )

    except WebSocketDisconnect:
        await manager.disconnect(websocket)
        await manager.broadcast_public({"type": "player_disconnected", "name": player_name})


# ---------------------------------------------------------------------------
# SPA Catch-all (Frontend Routing)
# ---------------------------------------------------------------------------

from fastapi.responses import FileResponse

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Catch-all route to serve the React SPA and its static assets."""
    if not CLIENT_DIST.is_dir():
        raise HTTPException(status_code=404, detail="Frontend not built")

    path = CLIENT_DIST / full_path
    if path.is_file():
        return FileResponse(path)
    
    # Fallback to index.html for React Router
    return FileResponse(CLIENT_DIST / "index.html")


# ---------------------------------------------------------------------------
# Server startup
# ---------------------------------------------------------------------------


def run_server() -> None:
    """Run Uvicorn in a background daemon thread."""
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


def main() -> None:
    ensure_firewall_rule(PORT)
    kernel.fire("on_session_start", session={"lan_ip": LAN_IP, "port": PORT})

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    dm_url = f"http://localhost:{PORT}/dm?token={HOST_TOKEN}"
    logger.info("DM window → %s", dm_url)
    logger.info("Players connect at → http://%s:%d/player?token=<player_token>", LAN_IP, PORT)

    webview.create_window(
        title="Open VTT — Dungeon Master",
        url=dm_url,
        width=1400,
        height=900,
        resizable=True,
    )
    webview.start()


if __name__ == "__main__":
    main()
