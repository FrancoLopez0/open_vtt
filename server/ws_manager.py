"""
Open VTT — WebSocket connection manager.

Tracks the DM (host) connection and all player connections by token.
Enforces token-based authentication at connect time.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class PlayerInfo:
    """Represents a registered player."""

    name: str
    connected: bool = False
    websocket: WebSocket | None = field(default=None, repr=False)


class ConnectionManager:
    """Manages WebSocket connections for the DM and all players.

    Token registry is populated at runtime via register_player().
    The host_token is set once at startup and never changes.
    """

    def __init__(self, host_token: str) -> None:
        self.host_token: str = host_token
        self.host_connection: WebSocket | None = None
        # Maps player_token -> PlayerInfo
        self.players: dict[str, PlayerInfo] = {}

        # Load persisted players
        from server.store import load_players
        loaded_players = load_players()
        for token, p_data in loaded_players.items():
            self.players[token] = PlayerInfo(name=p_data["name"], connected=False)
        if loaded_players:
            logger.info("Loaded %d players from disk", len(loaded_players))

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_player(self, name: str, token: str) -> None:
        """Register a new player with the given token.

        Called by the DM via POST /api/players before the player connects.
        """
        self.players[token] = PlayerInfo(name=name)
        
        # Save to disk
        from server.store import save_players
        save_players({t: {"name": p.name} for t, p in self.players.items()})
        
        logger.info("Registered player '%s' with token %s…", name, token[:8])

    def list_players(self) -> list[dict[str, Any]]:
        """Return all registered players with their connection status."""
        return [
            {
                "name": info.name,
                "token": token,
                "connected": info.connected,
            }
            for token, info in self.players.items()
        ]

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect_host(self, websocket: WebSocket, token: str) -> bool:
        """Accept and store the host WebSocket connection.

        Returns True on success, False if the token is invalid.
        """
        if token != self.host_token:
            await websocket.accept()
            await websocket.send_json({"type": "error", "code": 4001, "message": "Unauthorized"})
            await websocket.close(code=4001, reason="Unauthorized")
            logger.warning("Host connection rejected — invalid token")
            return False

        await websocket.accept()
        self.host_connection = websocket
        logger.info("Host connected")
        return True

    async def connect_player(self, websocket: WebSocket, token: str) -> bool:
        """Accept and store a player WebSocket connection.

        Returns True on success, False if the token is unknown.
        """
        if token not in self.players:
            await websocket.accept()
            await websocket.send_json({"type": "error", "code": 4001, "message": "Token not found"})
            await websocket.close(code=4001, reason="Token not found")
            logger.warning("Player connection rejected — unknown token %s…", token[:8])
            return False

        await websocket.accept()
        self.players[token].connected = True
        self.players[token].websocket = websocket
        logger.info("Player '%s' connected", self.players[token].name)
        return True

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket from whichever pool it belongs to."""
        if self.host_connection is websocket:
            self.host_connection = None
            logger.info("Host disconnected")
            return

        for token, info in self.players.items():
            if info.websocket is websocket:
                info.connected = False
                info.websocket = None
                logger.info("Player '%s' disconnected", info.name)
                return

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    async def broadcast_public(self, message: dict[str, Any]) -> None:
        """Send a message to all connected sockets (host + all players)."""
        targets: list[WebSocket] = []
        if self.host_connection:
            targets.append(self.host_connection)
            print(f"[WS Manager] Added host to targets")
        for token, info in self.players.items():
            if info.websocket:
                targets.append(info.websocket)
                print(f"[WS Manager] Added player {token} to targets")

        print(f"[WS Manager] Broadcasting to {len(targets)} targets")
        for ws in targets:
            try:
                await ws.send_json(message)
                print(f"[WS Manager] Successfully sent to a websocket")
            except Exception as e:
                logger.exception("Failed to send public message to a client")
                print(f"[WS Manager] Exception sending: {e}")

    async def send_to_host(self, message: dict[str, Any]) -> None:
        """Send a message exclusively to the DM (host) WebSocket.

        Use for secret rolls and DM-only events.
        """
        if self.host_connection:
            try:
                await self.host_connection.send_json(message)
            except Exception:
                logger.exception("Failed to send message to host")

    async def send_to_player(self, token: str, message: dict[str, Any]) -> None:
        """Send a message to a specific player by their token."""
        info = self.players.get(token)
        if info and info.websocket:
            try:
                await info.websocket.send_json(message)
            except Exception:
                logger.exception("Failed to send message to player '%s'", info.name)

    async def send_plugin_message(self, target: str, plugin_name: str, payload: dict) -> None:
        """Send a custom plugin message to a specific target.

        Args:
            target: "ALL", "DM", or a specific player's name.
            plugin_name: The name of the plugin sending the message.
            payload: The JSON-serializable data payload.
        """
        message = {
            "type": "plugin_message",
            "plugin": plugin_name,
            "payload": payload,
        }

        print(message)
        
        if target == "ALL":
            await self.broadcast_public(message)
        elif target == "DM":
            await self.send_to_host(message)
        else:
            # Find player by name
            for info in self.players.values():
                if info.name == target and info.websocket:
                    try:
                        await info.websocket.send_json(message)
                    except Exception:
                        logger.exception("Failed to send plugin message to player '%s'", target)
                    break
