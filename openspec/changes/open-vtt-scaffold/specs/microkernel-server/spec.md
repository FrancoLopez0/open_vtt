# microkernel-server Specification

## Purpose

Defines the behavior of the Python backend: startup sequence, FastAPI configuration, plugin loading, and pywebview window lifecycle.

## Requirements

### Requirement: Server Startup

The system MUST start a Uvicorn server on `0.0.0.0:8000` in a background daemon thread before opening the pywebview window.

#### Scenario: Normal startup

- GIVEN the user runs `python server/main.py`
- WHEN the process starts
- THEN Uvicorn binds to `0.0.0.0:8000` within 2 seconds
- AND a pywebview window opens pointing to `http://localhost:8000/dm?token=<host_token>`

#### Scenario: Port already in use

- GIVEN port 8000 is already bound by another process
- WHEN the server attempts to start
- THEN an `OSError` is raised with a human-readable message
- AND the pywebview window does NOT open

### Requirement: Static File Serving

The system MUST serve the Vite `dist/` directory under the root path `/`.

#### Scenario: Built frontend exists

- GIVEN `client/dist/index.html` exists
- WHEN a browser requests `http://localhost:8000/`
- THEN FastAPI returns the contents of `index.html` with status 200

#### Scenario: Frontend not built

- GIVEN `client/dist/` does not exist
- WHEN FastAPI mounts the static directory
- THEN startup raises a clear error indicating the frontend must be built first

### Requirement: Plugin Asset Serving

The system MUST serve each plugin's static assets (JS Web Components) under `/plugins/{plugin_name}/`.

#### Scenario: Plugin widget requested

- GIVEN plugin `example_plugin` is loaded and has `dm_widget.js`
- WHEN a browser requests `/plugins/example_plugin/dm_widget.js`
- THEN FastAPI returns the file with status 200 and `Content-Type: application/javascript`

### Requirement: Plugin Loading at Startup

The Kernel MUST scan `../plugins/` for subdirectories containing `__init__.py` and load each as a pluggy plugin using `importlib`.

#### Scenario: Valid plugin directory

- GIVEN `plugins/example_plugin/__init__.py` exists and registers hook implementations
- WHEN the Kernel initializes
- THEN the plugin is imported and registered with the pluggy PluginManager

#### Scenario: Directory without __init__.py

- GIVEN `plugins/broken_plugin/` has no `__init__.py`
- WHEN the Kernel scans the plugins directory
- THEN the directory is skipped with a warning log — startup continues

#### Scenario: Plugin raises import error

- GIVEN `plugins/bad_plugin/__init__.py` has a syntax error
- WHEN the Kernel attempts to import it
- THEN the error is caught, logged, and the remaining plugins continue loading
