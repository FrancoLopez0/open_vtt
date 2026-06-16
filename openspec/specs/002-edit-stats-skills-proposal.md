# Propuesta SDD: Edición de Stats y Skills (Issue #2)

## Objetivo
Permitir a los jugadores editar sus atributos (Stats) y habilidades (Skills) directamente desde su widget (`player_widget.js`), y asegurarse de que estos cambios persistan correctamente en el backend (`core_rpg` plugin).

## Análisis (Explore)
- **Backend (`plugins/core_rpg/__init__.py`)**: Cuando un jugador pide su hoja por primera vez, el backend genera un `_empty_sheet` que tiene solo 3 atributos (STR, DEX, INT) y ninguna habilidad. Esto sobrescribe el estado por defecto más completo que tiene el frontend (6 atributos y 8 habilidades). El método `save_sheet` ya guarda cualquier JSON que se le envíe, así que el backend solo necesita corregir su plantilla inicial.
- **Frontend (`plugins/core_rpg/player_widget.js`)**: 
  - Los stats se renderizan con `<input type="text" readonly />`.
  - Las skills se renderizan con `<span>`.
  - El método `_save()` ya funciona y envía la hoja al backend, pero solo está escuchando los cambios en HP.

## Cambios Propuestos (Design)

### 1. `plugins/core_rpg/__init__.py`
- **[MODIFY]**: Actualizar `_empty_sheet` para que devuelva los 6 atributos clásicos (STR, DEX, CON, INT, WIS, CHA) con valor "10", y el listado de skills en cero ("+0"). Así el backend establece el esquema correcto desde el principio.

### 2. `plugins/core_rpg/player_widget.js`
- **[MODIFY]**: 
  - Quitar el atributo `readonly` a los inputs de stats.
  - Convertir el valor de las skills de `<span>` a un `<input type="text">` con estilos integrados al diseño (transparente, texto dorado/claro).
  - En `_render()`, agregar delegación de eventos (`input` o `change`) a los contenedores `#stat-grid` y `#skills-grid`. Cuando el usuario edite un valor, actualizamos el array correspondiente en `this.sheet` y llamamos a `this._save()` con un pequeño debounce para no saturar el servidor por cada tecla.

## User Review Required
> [!IMPORTANT]
> - ¿Te parece bien guardar (auto-save) después de medio segundo de tipeo (debounce), como ya se hace con los HP? 
> - ¿Querés que los inputs de las habilidades (skills) tengan formato numérico estricto, o los dejamos de texto libre para poder poner cosas como "+3" o "Advantage"? (El plan propone texto libre para máxima flexibilidad).

## Plan de Verificación (Verify)
1. **Automated Tests**: No aplican directamente al widget sin un entorno de prueba de DOM.
2. **Prueba manual**:
   - Compilar el proyecto si es necesario (el plugin es vanilla JS y se sirve en caliente, pero por si acaso).
   - Conectarse como jugador en el puerto `20800`.
   - Modificar STR de "10" a "18". Modificar Stealth de "+0" a "+5".
   - Refrescar la página del jugador para verificar que el servidor devuelve los valores actualizados.
