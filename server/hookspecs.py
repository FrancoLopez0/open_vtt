"""
Open VTT — Pluggy hook specifications.

These define the event contract that plugins can implement.
"""

import pluggy

hookspec = pluggy.HookspecMarker("open_vtt")


class OpenVTTSpec:
    """Hook specifications for the Open VTT plugin system."""

    @hookspec
    def on_session_start(self, session: dict) -> None:
        """Fired when a game session begins.

        Args:
            session: A dict containing session metadata (e.g. session id, timestamp).
        """

    @hookspec
    def on_dice_roll(self, roller: str, result: int, secret: bool) -> None:
        """Fired when any dice roll occurs.

        Args:
            roller: The name of the player (or "DM") who rolled.
            result: The integer result of the roll.
            secret: If True, the roll is DM-only and must NOT be broadcast to players.
        """

    @hookspec
    def on_chat_message(self, sender: str, message: str) -> None:
        """Fired when any chat message is sent.

        Args:
            sender: Name of the sender.
            message: The message content.
        """

    @hookspec
    def on_plugin_message(self, sender: str, plugin: str, payload: dict) -> None:
        """Fired when a plugin-specific WebSocket message is received.

        Args:
            sender: The player name (or "DM") who sent the message.
            plugin: The target plugin name (e.g. "core_rpg").
            payload: The arbitrary JSON dictionary payload from the frontend.
        """

    @hookspec
    def on_player_connect(self, token: str, name: str) -> None:
        """Fired when a player successfully connects via WebSocket.

        Args:
            token: The player's unique token (UUID).
            name: The player's display name.
        """

    @hookspec
    def on_player_disconnect(self, token: str, name: str) -> None:
        """Fired when a player's WebSocket connection drops.

        Args:
            token: The player's unique token (UUID).
            name: The player's display name.
        """
