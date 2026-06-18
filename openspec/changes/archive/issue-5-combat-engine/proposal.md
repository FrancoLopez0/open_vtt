# Propuesta SDD: Motor de Combate e Initiative Tracker (Issue #5)

## Objetivo
Reemplazar el *placeholder* estático que dice "Combat Engine" en la vista del DM por un sistema interactivo y funcional que permita llevar el registro de iniciativa, turnos, rondas y Puntos de Golpe (HP) durante un encuentro.

## Análisis (Explore)
- El placeholder se encuentra en `client/src/views/DMView.tsx`, dentro del tab activo `combat`.
- El DM ya tiene acceso a la lista de `players` en ese componente (estado local que se hidrata por polling a `/api/players`).
- El tracker de combate necesita manejar múltiples entidades: jugadores reales y NPCs/Monstruos que el DM agregue manualmente.

## Cambios Propuestos (Design)

### 1. Nuevo Componente: `client/src/components/CombatEngine.tsx`
Se creará un nuevo componente en React que reciba la lista de `players` como *prop*. Este componente manejará su propio estado local (`useState`):
- `combatants`: Lista de participantes con `{ id, name, initiative, hp, is_player }`.
- `currentTurn`: Índice del participante actual.
- `round`: Número de ronda actual.
- `isActive`: Booleano para saber si el combate empezó.

**Funcionalidades de la interfaz:**
- **Agregar Jugadores:** Un botón para volcar automáticamente a todos los jugadores conectados al tracker.
- **Agregar NPC:** Un pequeño formulario en línea para que el DM agregue enemigos rápidos (Nombre, HP e Iniciativa).
- **Lista de Iniciativa:** Renderizado de la lista ordenada por iniciativa (de mayor a menor). El turno activo estará resaltado visualmente con un estilo premium (bordes dorados, fondo más claro).
- **Controles de Turno:** Botón grande de "Siguiente Turno" (avanza el índice y si llega al final, sube la ronda) y botón de "Terminar Combate" (limpia el estado).

### 2. Modificación de `client/src/views/DMView.tsx`
- **[MODIFY]**: Reemplazar el div estático en la línea ~338 por el nuevo componente `<CombatEngine players={players} />`.

## User Review Required
> [!IMPORTANT]
> **Persistencia del Combate:** Para esta primera iteración (MVP), propongo guardar el estado del combate **localmente en la memoria del navegador del DM** (React state). Esto significa que si recargás la página en medio del combate, se pierde la iniciativa. Hacerlo sincronizado con el servidor requiere tocar websockets y persistencia en Python.
> ¿Estás de acuerdo con arrancar con estado local para tener un tracker rápido y fluido, o preferís que lo atemos al backend desde el día 1? (Recomiendo arrancar local).

## Plan de Verificación (Verify)
1. **Prueba Manual**:
   - Abrir el dashboard del DM, ir a la pestaña "Combat".
   - Agregar 2 NPCs con distintas iniciativas.
   - Usar el botón de "Add Players" para traer a un jugador conectado.
   - Iniciar combate, verificar que la lista se ordena correctamente de mayor a menor iniciativa.
   - Apretar "Next Turn" varias veces y verificar que el marcador visual baja y la ronda aumenta al reiniciar el ciclo.
