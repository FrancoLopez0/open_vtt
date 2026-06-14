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
