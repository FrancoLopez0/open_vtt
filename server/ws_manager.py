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

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_player(self, name: str, token: str) -> None:
        """Register a new player with the given token.

        Called by the DM via POST /api/players before the player connects.
        """
        self.players[token] = PlayerInfo(name=name)
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
        for info in self.players.values():
            if info.websocket:
                targets.append(info.websocket)

        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                logger.exception("Failed to send public message to a client")

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
