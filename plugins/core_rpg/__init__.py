import logging
from typing import Any

from server.kernel import hookimpl

logger = logging.getLogger(__name__)

class CoreRPGPlugin:
    def __init__(self):
        # Store sheets by player name. In a real app, use player token or a DB.
        self.sheets: dict[str, dict[str, Any]] = {}

    @hookimpl
    def on_plugin_message(self, sender: str, plugin: str, payload: dict) -> None:
        if plugin != "core_rpg":
            return

        action = payload.get("action")
        
        if action == "save_sheet":
            sheet_data = payload.get("sheet", {})
            # If the DM is editing a sheet, they might pass a specific target.
            # Otherwise, the sender saves their own sheet.
            target_player = payload.get("target_player", sender)
            self.sheets[target_player] = sheet_data
            logger.info("Saved character sheet for %s", target_player)
            
            # Broadcast to DM and the specific player that the sheet was updated
            from server.main import kernel
            
            # Notify everyone to re-fetch if they are looking at it, or just push it
            update_msg = {
                "action": "sheet_updated",
                "player": target_player,
                "sheet": sheet_data
            }
            # Fire-and-forget async calls from a sync hook requires care, 
            # but kernel.send_message is an async coroutine. 
            # In a real architecture, hookspecs would be async.
            # For now, since hookspecs are sync in pluggy, we must schedule the task.
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(kernel.send_message("ALL", "core_rpg", update_msg))
            except RuntimeError:
                pass

        elif action == "get_sheet":
            # Someone requested a sheet
            target_player = payload.get("target_player", sender)
            sheet_data = self.sheets.get(target_player, self._empty_sheet(target_player))
            
            from server.main import kernel
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(kernel.send_message(sender, "core_rpg", {
                    "action": "sheet_data",
                    "player": target_player,
                    "sheet": sheet_data
                }))
            except RuntimeError:
                pass

    def _empty_sheet(self, token: str) -> dict[str, Any]:
        return {
            "name": "",
            "race": "Human",
            "class_name": "Fighter",
            "level": 1,
            "hp_current": 10,
            "hp_max": 10,
            "stats": [
                {"name": "STR", "value": "10"},
                {"name": "DEX", "value": "10"},
                {"name": "INT", "value": "10"}
            ],
            "inventory": ""
        }

plugin = CoreRPGPlugin()
