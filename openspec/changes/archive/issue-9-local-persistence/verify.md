# Walkthrough: Persistencia Local (Issue #9)

Implementamos exitosamente la persistencia local en archivos JSON para Open VTT, asegurando que tanto la lista de jugadores como el progreso del Motor de Combate sobrevivan a las recargas del navegador del DM o a caídas del servidor.

## Arquitectura (Local-First)
En lugar de forzar una base de datos pesada (como PostgreSQL o SQLite), implementamos un módulo liviano `store.py` que lee y escribe diccionarios directamente en la carpeta oculta `.data/`. 

Esta decisión asegura que cada módulo o plugin futuro (como el inventario, los mapas o las hojas de personaje) pueda tener su propio archivo `.data/plugin_xyz.json` de manera completamente aislada y descentralizada.

## Cambios Implementados

### Backend
1. **`server/store.py` (Nuevo):** Encargado de cargar y guardar `players.json` y `combat.json` en el directorio `.data`.
2. **Registro de Jugadores:** Se actualizó `server/ws_manager.py` para cargar los UUIDs de jugadores desde el archivo en disco al iniciar, e ir grabando la tabla cada vez que se invita un jugador nuevo. *Con esto los links de invitación son permanentes.*
3. **WebSockets de Host:** Modificamos el endpoint `/ws/host` en `main.py` para que:
   - Al conectar, le envíe inmediatamente el último estado del combate guardado (`combat_init`).
   - Escuche y grabe permanentemente eventos `combat_update` emitidos por el Frontend del DM.

### Frontend
1. **Recepción Inicial:** `DMView.tsx` ahora atrapa el mensaje `combat_init` vía websocket y se lo pasa por propiedades al componente de combate (`initialCombatState`).
2. **Sincronización:** Refactorizamos `CombatEngine.tsx` para aceptar el estado base y agregamos un `React.useEffect`. Cada vez que el turno, la ronda o los puntos de golpe cambien, la vista del DM dispara un `combat_update` al backend, actualizando silenciosamente el archivo `.json` de la sesión.

## Verificación Automática
- `npm run build` en la interfaz del cliente pasó sin errores TypeScript.
- `pytest` superó exitosamente la suite de test en el backend (se repararon 3 test cases críticos que fallaban al inyectar el nuevo evento previo a `host_connected`).

## ¿Cómo Probarlo?
1. Iniciá la aplicación y conectate como DM.
2. Agregá algunos jugadores y un NPC con iniciativa. Inicia el combate.
3. Apretá F5 para recargar tu navegador de DM (o bajá el servidor en la consola y volvelo a subir).
4. Verificá que la lista de jugadores y el combate retengan el último estado.
