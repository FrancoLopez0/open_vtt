# player-manager Specification

## Purpose

Defines the REST API that the DM uses to create players, list their connection status, and generate shareable join URLs.

## Requirements

### Requirement: List Players

The system MUST expose `GET /api/players` that returns all registered players and their connection status. This endpoint MUST require a valid host token.

#### Scenario: Authenticated list request

- GIVEN two players are registered: "Aragorn" (connected) and "Legolas" (disconnected)
- WHEN the DM calls `GET /api/players` with `X-Host-Token: <host_token>`
- THEN the response is HTTP 200 with body:
  ```json
  [
    {"name": "Aragorn", "token": "<uuid1>", "connected": true},
    {"name": "Legolas", "token": "<uuid2>", "connected": false}
  ]
  ```

#### Scenario: Unauthenticated list request

- GIVEN a request with no or invalid `X-Host-Token`
- WHEN `GET /api/players` is called
- THEN the response is HTTP 401

### Requirement: Create Player

The system MUST expose `POST /api/players` to register a new player and return their token and join URL. Defined in full in the `websocket-auth` spec.

### Requirement: Join URL Contains Server IP

The join URL returned by `POST /api/players` MUST use the server's LAN IP address (not `localhost`) so players on other devices can connect.

#### Scenario: Join URL generation

- GIVEN the server is running on a machine with LAN IP `192.168.1.10`
- WHEN the DM creates player "Gimli"
- THEN `join_url` is `http://192.168.1.10:8000/player?token=<uuid>`
- AND NOT `http://localhost:8000/player?token=<uuid>`

### Requirement: Plugin Metadata Endpoint

The system MUST expose `GET /api/plugins` returning metadata for all loaded plugins.

#### Scenario: Plugins loaded

- GIVEN `example_plugin` is loaded with `plugin.json` containing name, version, and description
- WHEN any client calls `GET /api/plugins`
- THEN the response is HTTP 200 with:
  ```json
  [
    {
      "name": "example_plugin",
      "version": "0.1.0",
      "description": "Demo dice roller",
      "dm_widget": "/plugins/example_plugin/dm_widget.js",
      "player_widget": "/plugins/example_plugin/player_widget.js"
    }
  ]
  ```

#### Scenario: No plugins loaded

- GIVEN the `plugins/` directory is empty
- WHEN `GET /api/plugins` is called
- THEN the response is HTTP 200 with an empty array `[]`
