import logging
import json
from pathlib import Path
from typing import Any

from server.kernel import hookimpl

logger = logging.getLogger(__name__)

class CoreRPGPlugin:
    def __init__(self):
        self.sheets: dict[str, dict[str, Any]] = {}
        self.data_dir = Path(__file__).parent.parent.parent / ".data"
        self.data_dir.mkdir(exist_ok=True)
        self.data_file = self.data_dir / "sheets.json"
        self._load_sheets()

    def _load_sheets(self):
        if self.data_file.exists():
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    self.sheets = json.load(f)
                logger.info(f"Loaded {len(self.sheets)} sheets from {self.data_file.name}")
            except Exception as e:
                logger.error(f"Failed to load sheets: {e}")

    def _save_sheets(self):
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.sheets, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sheets: {e}")

    def _get_player_name(self, token: str) -> str:
        from server.state import manager
        for p in manager.list_players():
            if p["token"] == token:
                return p["name"]
        # Fallback to token if not found (e.g. DM or testing)
        return token

    @hookimpl
    def on_plugin_message(self, sender: str, plugin: str, payload: dict) -> None:
        if plugin != "core_rpg":
            return

        action = payload.get("action")
        
        if action == "save_sheet":
            sheet_data = payload.get("sheet", {})
            target_player = payload.get("target_player", sender)
            player_name = self._get_player_name(target_player)
            
            # Update name in case it's empty
            sheet_data["name"] = player_name
            
            self.sheets[player_name] = sheet_data
            self._save_sheets()
            logger.info("Saved character sheet for %s (token %s)", player_name, target_player)
            
            from server.state import kernel
            
            update_msg = {
                "action": "sheet_updated",
                "player": target_player,
                "sheet": sheet_data
            }
            
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(kernel.send_message("ALL", "core_rpg", update_msg))
            except RuntimeError:
                pass

        elif action == "get_sheet":
            target_player = payload.get("target_player", sender)
            player_name = self._get_player_name(target_player)
            
            sheet_data = self.sheets.get(player_name, self._empty_sheet(player_name))
            
            from server.state import kernel
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

    def _empty_sheet(self, name: str) -> dict[str, Any]:
        return {
            "name": name,
            "race": "Human",
            "class_name": "Fighter",
            "level": 1,
            "hp_current": 45,
            "hp_max": 45,
            "mana_current": 22,
            "mana_max": 22,
            "stats": [
                {"name": "STR", "value": "10"},
                {"name": "DEX", "value": "10"},
                {"name": "CON", "value": "10"},
                {"name": "INT", "value": "10"},
                {"name": "WIS", "value": "10"},
                {"name": "CHA", "value": "10"}
            ],
            "skills": [
                {"name": "Athletics", "val": "+0"},
                {"name": "Stealth", "val": "+0"},
                {"name": "Acrobatics", "val": "+0"},
                {"name": "Nature", "val": "+0"},
                {"name": "Arcana", "val": "+0"},
                {"name": "History", "val": "+0"},
                {"name": "Insight", "val": "+0"},
                {"name": "Religion", "val": "+0"}
            ],
            "inventory": ""
        }

plugin = CoreRPGPlugin()
