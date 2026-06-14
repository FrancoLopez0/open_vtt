# plugin-system Specification

## Purpose

Defines the plugin contract: how plugins are discovered, loaded, registered with pluggy, and how they provide dual Web Components for the DM and Player views.

## Requirements

### Requirement: Plugin Discovery

The Kernel MUST discover plugins by scanning the `plugins/` directory for immediate subdirectories that contain both `__init__.py` and `plugin.json`.

#### Scenario: Valid plugin discovered

- GIVEN `plugins/example_plugin/__init__.py` and `plugins/example_plugin/plugin.json` both exist
- WHEN the Kernel scans `plugins/`
- THEN `example_plugin` is added to the discovered plugins list

#### Scenario: Subdirectory missing plugin.json

- GIVEN `plugins/incomplete_plugin/__init__.py` exists but `plugin.json` does not
- WHEN the Kernel scans `plugins/`
- THEN `incomplete_plugin` is skipped and a warning is logged

### Requirement: Plugin Metadata Format

Each plugin MUST provide a `plugin.json` with at minimum: `name`, `version`, `description`.

#### Scenario: Valid plugin.json

- GIVEN `plugin.json` contains `{"name": "example_plugin", "version": "0.1.0", "description": "Demo dice roller"}`
- WHEN the Kernel reads the metadata
- THEN it is stored and returned by `GET /api/plugins`

### Requirement: Pluggy Hook Registration

Each plugin's `__init__.py` MUST define a class that implements one or more hook specifications from `hookspecs.py` using `@hookimpl`.

#### Scenario: Hook implementation registered

- GIVEN `example_plugin` defines a class with `@hookimpl def on_dice_roll(self, roller, result, secret): ...`
- WHEN the Kernel calls `pm.register(plugin_instance)`
- THEN the hook is callable via `kernel.fire("on_dice_roll", ...)`

### Requirement: Hook Specifications

The system MUST define the following hooks in `hookspecs.py`:

| Hook | Parameters | Description |
|------|-----------|-------------|
| `on_session_start` | `session` | Fired when a game session begins |
| `on_dice_roll` | `roller, result, secret` | Fired on any dice roll; `secret=True` means DM-only |
| `on_chat_message` | `sender, message` | Fired when any chat message is sent |

#### Scenario: Hook fired with no implementations

- GIVEN no plugin implements `on_session_start`
- WHEN `kernel.fire("on_session_start", session={})` is called
- THEN no error is raised — pluggy returns an empty result list

### Requirement: Dual Web Component Contract

Each plugin that provides UI MUST export:
- A `dm_widget.js` defining a Custom Element for the DM view
- A `player_widget.js` defining a Custom Element for the Player view

The custom element name MUST follow the pattern `<{plugin_name_kebab}-dm>` and `<{plugin_name_kebab}-player>`.

#### Scenario: DM widget defined

- GIVEN `dm_widget.js` calls `customElements.define("example-plugin-dm", ExamplePluginDM)`
- WHEN the browser loads the script
- THEN `<example-plugin-dm>` is a valid custom element

#### Scenario: Plugin without UI widgets

- GIVEN a plugin has no `dm_widget.js` or `player_widget.js`
- WHEN `GET /api/plugins` is called
- THEN that plugin's entry has `"dm_widget": null, "player_widget": null`
- AND `PluginSlot` does not attempt to load any script for it
