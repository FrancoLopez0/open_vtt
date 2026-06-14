"""
Open VTT — Microkernel.

Discovers, loads, and manages plugins at startup.
Exposes the pluggy hook caller and plugin metadata for the REST API.
"""

from __future__ import annotations

import importlib
import json
import logging
import sys
from pathlib import Path
from typing import Any

import pluggy

from hookspecs import OpenVTTSpec

logger = logging.getLogger(__name__)

PROJECT_NAME = "open_vtt"
hookimpl = pluggy.HookimplMarker(PROJECT_NAME)


class Kernel:
    """Microkernel: plugin discovery, loading, and event dispatch.

    Scans the plugins/ directory at startup. Each subdirectory that
    contains both __init__.py and plugin.json is treated as a valid plugin.
    """

    def __init__(self, plugins_dir: Path) -> None:
        self.plugins_dir: Path = plugins_dir
        self._metadata: list[dict[str, Any]] = []

        # Set up pluggy
        self._pm = pluggy.PluginManager(PROJECT_NAME)
        self._pm.add_hookspecs(OpenVTTSpec)

        self._load_plugins()

    # ------------------------------------------------------------------
    # Plugin discovery and loading
    # ------------------------------------------------------------------

    def _load_plugins(self) -> None:
        """Scan plugins_dir and load all valid plugins."""
        if not self.plugins_dir.is_dir():
            logger.warning("Plugins directory not found: %s", self.plugins_dir)
            return

        # Ensure the plugins directory is importable
        plugins_parent = str(self.plugins_dir.parent)
        if plugins_parent not in sys.path:
            sys.path.insert(0, plugins_parent)

        for entry in sorted(self.plugins_dir.iterdir()):
            if not entry.is_dir():
                continue

            init_file = entry / "__init__.py"
            meta_file = entry / "plugin.json"

            if not init_file.exists():
                logger.warning("Skipping '%s': no __init__.py found", entry.name)
                continue

            if not meta_file.exists():
                logger.warning("Skipping '%s': no plugin.json found", entry.name)
                continue

            self._load_single_plugin(entry, meta_file)

    def _load_single_plugin(self, plugin_dir: Path, meta_file: Path) -> None:
        """Import a single plugin and register it with pluggy."""
        plugin_name = plugin_dir.name
        module_name = f"plugins.{plugin_name}"

        try:
            metadata = json.loads(meta_file.read_text(encoding="utf-8"))
        except Exception:
            logger.exception("Failed to read plugin.json for '%s'", plugin_name)
            return

        try:
            module = importlib.import_module(module_name)
        except Exception:
            logger.exception("Failed to import plugin '%s'", plugin_name)
            return

        # Expect the module to expose a Plugin class or a module-level instance
        plugin_instance = None
        if hasattr(module, "Plugin"):
            plugin_instance = module.Plugin()
        elif hasattr(module, "plugin"):
            plugin_instance = module.plugin
        else:
            logger.warning(
                "Plugin '%s' has no 'Plugin' class or 'plugin' instance — skipping registration",
                plugin_name,
            )

        if plugin_instance is not None:
            self._pm.register(plugin_instance, name=plugin_name)
            logger.info("Loaded plugin '%s' v%s", plugin_name, metadata.get("version", "?"))

        # Resolve widget URLs
        dm_widget = (
            f"/plugins/{plugin_name}/dm_widget.js"
            if (plugin_dir / "dm_widget.js").exists()
            else None
        )
        player_widget = (
            f"/plugins/{plugin_name}/player_widget.js"
            if (plugin_dir / "player_widget.js").exists()
            else None
        )

        self._metadata.append(
            {
                "name": plugin_name,
                "version": metadata.get("version", "0.0.0"),
                "description": metadata.get("description", ""),
                "dm_widget": dm_widget,
                "player_widget": player_widget,
            }
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_plugin_metadata(self) -> list[dict[str, Any]]:
        """Return metadata for all successfully loaded plugins."""
        return self._metadata

    def fire(self, hook_name: str, **kwargs: Any) -> list[Any]:
        """Invoke a named hook on all registered plugins.

        Returns the list of results from each hook implementation.
        """
        hook = getattr(self._pm.hook, hook_name, None)
        if hook is None:
            logger.warning("Unknown hook: '%s'", hook_name)
            return []
        return hook(**kwargs)
