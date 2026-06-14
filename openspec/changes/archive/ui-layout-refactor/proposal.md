# SDD Proposal: UI Layout Refactor

## Problem Statement
Actualmente, el layout asigna la mayor parte del espacio al chat (`layout-main`), mientras que los plugins (donde ahora viven las Hojas de Personaje y tiradores de dados) están confinados a una barra lateral pequeña (`sidebar`). Esto hace que la información crítica (HP, Stats, Inventario) sea difícil de ver y usar. 

Además, la vista del DM necesita mostrar "tarjetas" (cards) de los jugadores de manera más clara para monitorear el estado del grupo (HP, online/offline, etc.).

## Exploration
Ya que tenemos **Tailwind v4** instalado, podemos abandonar el CSS estricto actual para la estructura principal y rediseñar el layout:
1. **Invertir Prioridades:** El área principal (`flex-1`) debe estar dedicada a los plugins (La mesa virtual, hojas de personaje, mapas en un futuro). El chat debe ser una barra lateral derecha (tipo Twitch/Discord) o un panel sobrepuesto (overlay).
2. **Sistema de Cartas (DM):** El DM debe ver una cuadrícula (grid) con "Cards" por cada jugador. La Card del jugador mostrará su vida (HP) y estado, obteniendo estos datos del plugin `core_rpg`.

## Proposed Architecture
- **Refactor de Layout (Player & DM):**
  - Cambiar el contenedor principal a un `flex-row`.
  - El **PluginSlot** tomará el `flex-1` (todo el espacio disponible).
  - El **Chat** pasará a ser un panel lateral (ej. `w-80` = 320px) que se desliza o aparece/desaparece con el botón de "Show Chat".
- **Mejora del DM View:**
  - Integrar la lista de jugadores y el `core-rpg-dm` en un grid más amigable.

## Risks & Trade-offs
- **Riesgo:** Romper la estética oscura al reescribir cosas.
- **Mitigación:** Mantener los colores base (variables CSS) pero usar utilidades de Tailwind (`bg-[#13131f]`, `text-amber-400`, etc.) para el posicionamiento y la cuadrícula.

## Open Questions
- **Posición del Chat:** ¿Querés que el chat aparezca como una barra fija a la derecha cuando se abre, o como un panel flotante que tape parte de la pantalla?
