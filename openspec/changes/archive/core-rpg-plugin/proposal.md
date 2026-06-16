# SDD Proposal: Core RPG Plugin & Architecture Upgrade

## Problem Statement
Actualmente, el sistema de plugins de Open VTT es unidireccional y pasivo: los plugins pueden escuchar el chat y los dados, pero no pueden enviar ni recibir datos estructurados complejos (como un JSON de una hoja de personaje) desde el frontend hacia el backend. Para crear un plugin base (`core_rpg`) que maneje hojas de personajes genéricas, necesitamos actualizar la arquitectura del Kernel y luego implementar el plugin.

## Exploration
Para lograr esto, necesitamos:
1. **Actualización del Kernel:** Permitir que los WebSockets en `server/main.py` reciban eventos de tipo `plugin_message` y los despachen al Kernel de plugins, y permitir que los plugins envíen mensajes de vuelta al frontend.
2. **Plugin `core_rpg`:** Un plugin base que brinde una hoja de personaje genérica (Nombre, HP, Inventario, y una lista de atributos dinámicos) que pueda ser usada en cualquier TTRPG.

### Opciones de Arquitectura de Comunicación
- **Opción A (REST API Custom):** Permitir que cada plugin registre rutas en FastAPI. *Desventaja*: Complica la seguridad y el enrutamiento.
- **Opción B (WebSocket Plugin Messages):** Usar el WebSocket existente pero agregar un tipo de evento `"plugin_message"`. *Ventaja*: Tiempo real, fácil de implementar, mantiene todo en la misma conexión. **(Elegida)**

## Proposed Architecture

### 1. Upgrade del Kernel y WebSockets
- **`hookspecs.py`**: Agregar un hook `on_plugin_message(sender: str, plugin_name: str, payload: dict)`.
- **`main.py`**: En `ws_player` y `ws_host`, interceptar el `event_type == "plugin_message"` y ejecutar `kernel.fire("on_plugin_message", ...)`.
- **Callback Inyectable**: Modificar `Kernel` para que los plugins puedan importar una función central o recibir un callback para enviar mensajes (`dispatch_to_client(token, message)`).

### 2. El Plugin `core_rpg`
- **Backend (`plugins/core_rpg/__init__.py`)**: Almacena un `dict` en memoria con las hojas de personajes. Escucha `on_plugin_message` para actualizar o enviar la hoja.
- **Frontend Jugador (`player_widget.js`)**: Renderiza un Web Component `<core-rpg-player>` con campos genéricos: Name, HP (Current/Max), Attributes (flexibles), e Inventory. 
- **Frontend DM (`dm_widget.js`)**: Renderiza `<core-rpg-dm>`, listando las hojas de todos los jugadores conectados.

## Risks & Trade-offs
- **Riesgo:** El esquema de la hoja de personaje puede ser demasiado rígido para algunos juegos o demasiado laxo para otros.
- **Mitigación:** Diseñar el esquema como una lista de campos clave-valor dinámicos (ej. `[ {name: "Fuerza", value: 16}, ... ]`) para que los jugadores puedan adaptarlo a cualquier sistema.

## Open Questions
- **Manejo de WebSockets en Frontend:** ¿Preferís que la app React exponga una función global (ej. `window.sendPluginMessage`) para que los plugins la llamen, o que los Web Components emitan un evento DOM nativo (ej. `this.dispatchEvent(new CustomEvent('send-ws', ...))`) que React intercepte? El evento DOM es más limpio y desacoplado.
- **Esquema de Personaje:** ¿Querés definir stats específicos fijos (ej. STR, DEX, INT) o los dejamos como campos de texto libres donde el jugador escribe el nombre del stat y el valor?
