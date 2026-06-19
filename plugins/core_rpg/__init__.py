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

            # --- Bridge to native character_sheet_data protocol ---
            # Normalize the plugin schema to the standard format so DM player
            # cards can display HP bars regardless of which sheet plugin is active.
            try:
                from server.state import manager as _mgr
                stats = {s["name"]: int(s.get("value", 10)) for s in sheet_data.get("stats", [])}
                normalized = {
                    "character_name": sheet_data.get("name", ""),
                    "char_class":     sheet_data.get("class_name", ""),
                    "race":           sheet_data.get("race", ""),
                    "level":          int(sheet_data.get("level", 1)),
                    "hp":             int(sheet_data.get("hp_current", 0)),
                    "max_hp":         int(sheet_data.get("hp_max", 1)),
                    "armor_class":    10,
                    "speed":          30,
                    "strength":       stats.get("STR", 10),
                    "dexterity":      stats.get("DEX", 10),
                    "constitution":   stats.get("CON", 10),
                    "intelligence":   stats.get("INT", 10),
                    "wisdom":         stats.get("WIS", 10),
                    "charisma":       stats.get("CHA", 10),
                    "proficiency_bonus": 2,
                    "background":     "",
                    "traits":         "",
                    "equipment":      sheet_data.get("inventory", ""),
                    "conditions":     [],
                }
                _mgr.set_player_sheet(target_player, normalized)

                import asyncio
                loop = asyncio.get_running_loop()
                loop.create_task(_mgr.send_to_host({
                    "type":  "character_sheet_data",
                    "token": target_player,
                    "name":  player_name,
                    "sheet": normalized,
                }))
            except Exception as _e:
                logger.warning("Could not bridge sheet to native protocol: %s", _e)
            # --- End bridge ---
            
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
            "name":                name,
            "race":                "Human",
            "class_name":          "Fighter",
            "subclass":            "",
            "level":               1,
            "background":          "",
            "alignment":           "",
            "experience":          0,
            "hp_current":          10,
            "hp_max":              10,
            "hp_temp":             0,
            "mana_current":        0,
            "mana_max":            0,
            "armor_class":         10,
            "initiative":          0,
            "speed":               30,
            "hit_dice":            "1d10",
            "proficiency_bonus":   2,
            "inspiration":         False,
            "death_saves_success": 0,
            "death_saves_failure": 0,
            "stats": [
                {"name": "STR", "value": 10},
                {"name": "DEX", "value": 10},
                {"name": "CON", "value": 10},
                {"name": "INT", "value": 10},
                {"name": "WIS", "value": 10},
                {"name": "CHA", "value": 10},
            ],
            "skills": [
                {"name": "Acrobatics",      "ability": "DEX", "proficient": False},
                {"name": "Animal Handling", "ability": "WIS", "proficient": False},
                {"name": "Arcana",          "ability": "INT", "proficient": False},
                {"name": "Athletics",       "ability": "STR", "proficient": False},
                {"name": "Deception",       "ability": "CHA", "proficient": False},
                {"name": "History",         "ability": "INT", "proficient": False},
                {"name": "Insight",         "ability": "WIS", "proficient": False},
                {"name": "Intimidation",    "ability": "CHA", "proficient": False},
                {"name": "Investigation",   "ability": "INT", "proficient": False},
                {"name": "Medicine",        "ability": "WIS", "proficient": False},
                {"name": "Nature",          "ability": "INT", "proficient": False},
                {"name": "Perception",      "ability": "WIS", "proficient": False},
                {"name": "Performance",     "ability": "CHA", "proficient": False},
                {"name": "Persuasion",      "ability": "CHA", "proficient": False},
                {"name": "Religion",        "ability": "INT", "proficient": False},
                {"name": "Sleight of Hand", "ability": "DEX", "proficient": False},
                {"name": "Stealth",         "ability": "DEX", "proficient": False},
                {"name": "Survival",        "ability": "WIS", "proficient": False},
            ],
            "saving_throws": [
                {"ability": "STR", "proficient": False},
                {"ability": "DEX", "proficient": False},
                {"ability": "CON", "proficient": False},
                {"ability": "INT", "proficient": False},
                {"ability": "WIS", "proficient": False},
                {"ability": "CHA", "proficient": False},
            ],
            "conditions":    [],
            "languages":     "Common",
            "proficiencies": "",
            "traits":        "",
            "ideals":        "",
            "bonds":         "",
            "flaws":         "",
            "features":      "",
            "equipment":     "",
            "inventory":     "",
            "spells":        "",
            "notes":         "",
            "portrait_url":  "",
        }

plugin = CoreRPGPlugin()
