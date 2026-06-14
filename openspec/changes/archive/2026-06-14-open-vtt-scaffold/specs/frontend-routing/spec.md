# frontend-routing Specification

## Purpose

Defines the React SPA routing behavior, view isolation, and the PluginSlot component that renders plugin Web Components dynamically.

## Requirements

### Requirement: Route Isolation

The system MUST define two fully isolated routes that cannot accidentally cross-render.

| Route | View | Intended user |
|-------|------|----------------|
| `/dm` | `DMView` | DM only (pywebview) |
| `/player` | `PlayerView` | Players (browser) |
| `/` | Redirect to `/player` | Default for browsers |

#### Scenario: DM route renders DM view

- GIVEN the pywebview window navigates to `http://localhost:8000/dm?token=<host_token>`
- WHEN React Router processes the URL
- THEN only `DMView` is rendered — `PlayerView` is never mounted

#### Scenario: Player route renders player view

- GIVEN a browser navigates to `http://192.168.1.10:8000/player?token=<player_token>`
- WHEN React Router processes the URL
- THEN only `PlayerView` is rendered — `DMView` is never mounted

#### Scenario: Root redirect

- GIVEN a browser navigates to `http://192.168.1.10:8000/`
- WHEN React Router processes the URL
- THEN the browser is redirected to `/player`

### Requirement: DM View Connects as Host

`DMView` MUST read the host token from the URL query param and establish a WebSocket connection to `/ws/host`.

#### Scenario: Host WebSocket established

- GIVEN `DMView` mounts with `?token=<host_token>`
- WHEN the component initializes
- THEN a WebSocket is opened to `ws://<server>/ws/host?token=<host_token>`
- AND the connection status is displayed in the UI

#### Scenario: Token missing from URL

- GIVEN `DMView` mounts with no `token` query param
- WHEN the component initializes
- THEN an error state is shown: "No host token — restart the application"

### Requirement: Player View Connects as Player

`PlayerView` MUST read the player token from the URL query param and establish a WebSocket connection to `/ws/player`.

#### Scenario: Player WebSocket established

- GIVEN `PlayerView` mounts with `?token=<player_token>`
- WHEN the component initializes
- THEN a WebSocket is opened to `ws://<server>/ws/player?token=<player_token>`

#### Scenario: Token rejected by server

- GIVEN the server closes the WebSocket with code 4001
- WHEN `PlayerView` receives the close event
- THEN an error screen is shown: "Invalid token — ask your DM for a join link"

### Requirement: PluginSlot Dynamic Rendering

`PluginSlot` MUST fetch `/api/plugins`, dynamically load each plugin's JS file as a `<script>` tag, and render the corresponding custom element.

#### Scenario: DM plugin slot renders DM widgets

- GIVEN `<PluginSlot role="dm" />` is mounted and `example_plugin` is loaded
- WHEN the component fetches `/api/plugins` and loads `dm_widget.js`
- THEN `<example-plugin-dm>` is rendered in the DOM

#### Scenario: Player plugin slot renders player widgets

- GIVEN `<PluginSlot role="player" />` is mounted
- WHEN the component fetches `/api/plugins` and loads `player_widget.js`
- THEN `<example-plugin-player>` is rendered in the DOM

#### Scenario: No plugins available

- GIVEN `/api/plugins` returns `[]`
- WHEN `PluginSlot` processes the response
- THEN no script tags are injected and no custom elements are rendered
