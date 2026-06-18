# Persistencia Local: Jugadores y Motor de Combate (Issue #9)

Implementar persistencia en disco (JSON) para que el estado de la sesión sobreviva a reinicios del servidor y recargas de la ventana del Dungeon Master.

## User Review Required

> [!IMPORTANT]
> **Sincronización del Combate:** Para guardar el combate propongo usar el canal actual de WebSockets del host. Cada vez que el DM haga un cambio (siguiente turno, editar HP, etc.), el frontend enviará un evento `combat_update` al backend, y éste lo guardará en disco. Al recargar la página, el backend le enviará un `combat_init` con el último estado guardado. ¿Estás de acuerdo con este enfoque o preferís endpoints REST separados (`GET /api/combat`, `POST /api/combat`)?

## Open Questions

> [!WARNING]
> Actualmente los `tokens` de los jugadores generados en `/api/players` son UUIDs aleatorios que cambian cada vez que se genera una invitación. Si guardamos los jugadores en disco, los UUIDs se mantendrán. ¿Querés que los jugadores tengan URLs de invitación permanentes (reusables entre sesiones) o preferís que las invitaciones expiren al reiniciar el server? Con este plan, los tokens serán permanentes y reusables.

## Proposed Changes

---

### Backend (Python)

#### [NEW] `server/store.py`
Módulo sencillo encargado de interactuar con el sistema de archivos:
- Leer/Escribir en `.data/players.json`.
- Leer/Escribir en `.data/combat.json`.
- Expondrá funciones como `load_players()`, `save_players(data)`, `load_combat_state()`, `save_combat_state(data)`.

#### [MODIFY] `server/ws_manager.py`
- En el constructor `__init__`, cargar el diccionario de jugadores llamando a `store.load_players()`.
- En el método `register_player()`, luego de agregar al jugador, llamar a `store.save_players()` para persistir el nuevo registro en disco.

#### [MODIFY] `server/main.py`
- Integrar la persistencia del combate en el endpoint `/ws/host`:
  - Al conectarse el host, enviarle inmediatamente un mensaje `{"type": "combat_init", "state": <estado>}` cargado desde `store.py`.
  - Escuchar eventos entrantes tipo `"combat_update"`. Al recibirlos, guardar el `payload` en `.data/combat.json`.

---

### Frontend (React)

#### [MODIFY] `client/src/views/DMView.tsx`
- En el `onmessage` del WebSocket, interceptar el evento `combat_init` y guardar ese estado en una variable local de React (ej. `initialCombatState`).
- Pasar este `initialCombatState` como *prop* al componente `<CombatEngine />`.

#### [MODIFY] `client/src/components/CombatEngine.tsx`
- En la inicialización, si se provee un `initialState` válido, usarlo para setear el estado de `combatants`, `activeTurnId`, `round` e `isActive`.
- Crear un hook de efecto (`useEffect`) o refactorizar los setters de estado para que, ante cualquier cambio significativo en el combate, se emita un evento local `send-ws`:
  ```javascript
  window.dispatchEvent(new CustomEvent('send-ws', { 
    detail: { 
      type: 'combat_update', 
      state: { combatants, activeTurnId, round, isActive } 
    } 
  }));
  ```
  *(Se agregará un pequeño debounce o se enviará explícitamente en las acciones de turno/edición para no saturar el canal).*

## Verification Plan

### Manual Verification
1. Abrir la sesión del DM y crear 2 jugadores. Verificar que aparezca `.data/players.json`.
2. Bajar el servidor (`Ctrl+C`) y volver a subirlo.
3. Al recargar la vista del DM, los jugadores deberían seguir en la lista como "Offline" pero registrados.
4. Iniciar un combate, agregar 1 NPC, e iniciar los turnos.
5. Recargar la página (F5) en la vista del DM. Al cargar la pestaña de combate, el NPC, los turnos y la ronda deberían restaurarse tal como estaban antes del F5.
