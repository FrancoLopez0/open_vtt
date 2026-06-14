"""
Example Plugin — Demo dice roller.

Implements the on_dice_roll hook to log all roll events.
Provides dm_widget.js and player_widget.js as Web Components.
"""

import logging

import pluggy

hookimpl = pluggy.HookimplMarker("open_vtt")

logger = logging.getLogger(__name__)


class Plugin:
    """Example plugin implementation."""

    @hookimpl
    def on_dice_roll(self, roller: str, result: int, secret: bool) -> None:
        """Log every dice roll that passes through the event bus."""
        if secret:
            logger.info("[example_plugin] SECRET roll by %s: %d (DM only)", roller, result)
        else:
            logger.info("[example_plugin] %s rolled %d", roller, result)

    @hookimpl
    def on_session_start(self, session: dict) -> None:
        logger.info("[example_plugin] Session started: %s", session)
