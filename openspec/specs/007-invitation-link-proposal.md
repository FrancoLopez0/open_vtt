# Propuesta SDD: Botón de Link de Invitación (Issue #7)

## Objetivo
Implementar un botón "Copiar Enlace" en el panel del DM para cada jugador conectado. Este enlace debe contener la IP local, el puerto y el token único del jugador (ej. `http://192.168.x.x:20800/player?token=abc-123`) para facilitar la conexión rápida sin pasos adicionales.

## Análisis (Explore)
- **Backend (`server/main.py`)**: Ya se está generando y devolviendo el `join_url` correctamente en el endpoint `/api/players` y durante la creación (POST `/api/players`).
- **Frontend (`DMView.tsx`)**: Actualmente, la lista de jugadores renderiza el `join_url` como un texto plano (`Link: {p.join_url}`) dentro del componente de la tarjeta del jugador (línea 305).
- **Necesidad**: Solamente hace falta agregar un botón de copiado (`navigator.clipboard.writeText`) al lado del link, y opcionalmente un pequeño feedback visual (cambio de icono o texto) que indique que se copió.

## Cambios Propuestos (Design)

### `client/src/views/DMView.tsx`
- **[MODIFY]** `client/src/views/DMView.tsx`:
  - En la renderización de los jugadores, agregar un botón junto al enlace.
  - Como ya existe `appendLog` en el `DMView`, cuando el DM copie el enlace podemos enviar un mensaje del sistema privado al chat interno: `appendLog({ type: 'system', text: 'Enlace copiado al portapapeles.' })`. Esto evita tener que instalar librerías adicionales de "Toasts".
  - También agregaremos un tooltip nativo (`title`) para que quede claro para qué sirve el botón.

## Plan de Verificación (Verify)
1. **Prueba manual**:
   - Compilar el cliente o usar el modo dev.
   - Abrir la vista del DM y crear un jugador ficticio.
   - Hacer click en el botón de copiar enlace.
   - Verificar que el enlace en el portapapeles sea correcto y que el log registre "Enlace copiado al portapapeles".
