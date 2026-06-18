import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / ".data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

PLAYERS_FILE = DATA_DIR / "players.json"
COMBAT_FILE = DATA_DIR / "combat.json"

def load_players() -> dict[str, dict[str, Any]]:
    if PLAYERS_FILE.exists():
        try:
            with open(PLAYERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to load players.json: %s", e)
    return {}

def save_players(players_data: dict[str, dict[str, Any]]) -> None:
    try:
        with open(PLAYERS_FILE, "w", encoding="utf-8") as f:
            json.dump(players_data, f, indent=2)
    except Exception as e:
        logger.error("Failed to save players.json: %s", e)

def load_combat_state() -> dict[str, Any]:
    if COMBAT_FILE.exists():
        try:
            with open(COMBAT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to load combat.json: %s", e)
    return {}

def save_combat_state(state: dict[str, Any]) -> None:
    try:
        with open(COMBAT_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error("Failed to save combat.json: %s", e)
