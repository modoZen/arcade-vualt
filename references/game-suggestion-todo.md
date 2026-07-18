# TODO de sugerencias de juegos — game-planner

Log/TODO persistente del agente `game-planner` con los juegos candidatos a sumar al catálogo. No se borra ni se reescribe desde cero: cada corrida agrega filas nuevas y, si recibe feedback, actualiza la columna Estado de filas existentes.

Estados posibles: `propuesto` (pendiente de decisión), `aceptado` (el usuario lo eligió), `rechazado` (el usuario lo descartó, con motivo en Notas si se dio), `implementado` (ya tiene spec en `specs/`).

| Fecha | Juego sugerido | Categoría/Color | Motor de referencia | Esfuerzo | Estado | Notas |
| ----- | -------------- | --------------- | ------------------- | -------- | ------ | ----- |
