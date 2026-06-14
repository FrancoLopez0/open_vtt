# websocket-auth Specification

## Purpose

Defines the token-based authentication model for WebSocket connections. The DM (Host) authenticates with a startup-generated host token. Each player authenticates with a unique UUID token created by the DM.

## Requirements

### Requirement: Host Token Generation

The system MUST generate a cryptographically random host token at startup using `secrets.token_urlsafe()`.

#### Scenario: Token generation

- GIVEN the server process starts
- WHEN `main.py` initializes
- THEN a unique `host_token` is generated and held in memory
- AND it is injected into the pywebview URL as `?token=<host_token>`
- AND it is never written to disk or returned by any public API endpoint

### Requirement: Host WebSocket Authentication

The system MUST accept a WebSocket connection on `/ws/host` only when the `token` query parameter matches the in-memory `host_token`.

#### Scenario: Valid host token

- GIVEN the pywebview window connects to `/ws/host?token=<host_token>`
- WHEN the WebSocket handshake is initiated
- THEN the connection is accepted and stored as the host connection

#### Scenario: Invalid host token

- GIVEN a browser connects to `/ws/host?token=wrong`
- WHEN the WebSocket handshake is initiated
- THEN the connection is closed with code 4001 and reason "Unauthorized"

#### Scenario: Missing token

- GIVEN a request to `/ws/host` with no `token` parameter
- WHEN the WebSocket handshake is initiated
- THEN the connection is closed with code 4001

### Requirement: Player Token Registration

The DM MUST be able to register a new player, causing the system to generate a UUID token and return a shareable join URL.

#### Scenario: Create player

- GIVEN the DM calls `POST /api/players` with `{"name": "Aragorn"}` and a valid host token in the `X-Host-Token` header
- WHEN the request is processed
- THEN the system generates `player_token = str(uuid.uuid4())`
- AND stores `{token: {name: "Aragorn", connected: false}}` in the player registry
- AND returns `{"name": "Aragorn", "token": "<uuid>", "join_url": "http://<server-ip>:8000/player?token=<uuid>"}`

#### Scenario: Create player without host token

- GIVEN a request to `POST /api/players` with no `X-Host-Token` header
- WHEN the request is processed
- THEN the system returns HTTP 401

### Requirement: Player WebSocket Authentication

The system MUST accept a WebSocket connection on `/ws/player` only when the `token` query parameter matches a registered player token.

#### Scenario: Valid player token

- GIVEN player "Aragorn" was registered with token `abc-123`
- WHEN a browser connects to `/ws/player?token=abc-123`
- THEN the connection is accepted and stored under `abc-123` in the player pool
- AND the player's `connected` status is set to `true`

#### Scenario: Unregistered player token

- GIVEN token `unknown-xyz` has not been registered
- WHEN a browser connects to `/ws/player?token=unknown-xyz`
- THEN the connection is closed with code 4001 and reason "Token not found"

#### Scenario: Player disconnects

- GIVEN a player is connected
- WHEN the WebSocket connection drops
- THEN the player's `connected` status is set to `false`
- AND the WebSocket is removed from the player pool
