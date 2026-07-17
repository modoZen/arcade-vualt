# SPEC 07 — Juego real de Tetris

> **Status:** Aprobado
> **Depends on:** SPEC 05 (juego real de Asteroides, motor de referencia), SPEC 06 (catálogo y leaderboard reales en Supabase)
> **Date:** 2026-07-17
> **Objective:** Agregar el juego real de Tetris (adaptado desde `references/started-games/03-tetris/game.js`) como una nueva entrada `tetris` en el catálogo, con su propio Reproductor dedicado en `/juego/tetris/jugar`, sincronizando el motor con el HUD, el leaderboard y los controles existentes.

## Scope

**In:**

- Nueva entrada `tetris` en la tabla `games` de Supabase (independiente de `asteroides`), insertada vía `mcp__supabase__apply_migration`.
- Componente `components/games/TetrisGame.tsx` ("use client"): encapsula el motor completo adaptado de `references/started-games/03-tetris/game.js` (funciones `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `draw`, `drawBlock`, `drawGrid`, `drawNext`) dentro de un único `<canvas>` propio (tablero + preview de "siguiente pieza" combinados en el mismo canvas, ver Notas de portado del motor), escalado por CSS al contenedor `.crt-screen` existente.
- El componente acepta las mismas 5 props que `AsteroidsGame`: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- Tetris tiene **1 vida**: `onLivesChange` reporta `1` al iniciar la partida y `0` en el instante en que `spawn()` detecta que la pieza nueva colisiona (condición de derrota del original).
- Se elimina el `endGame()` del motor original (overlay DOM `#overlay`/`#overlay-title`/`#overlay-score` + botón `#restart-btn`) — en su lugar, en el instante en que `spawn()` detecta colisión, se invoca `onGameOver(score)` una sola vez (con guard); el modal de React reemplaza por completo ese overlay.
- Se elimina el atajo de teclado `P` (pausa interna) — la pausa pasa a estar controlada exclusivamente por la prop `paused` desde React, igual que Asteroides.
- Se elimina el toggle de tema claro/oscuro (`applyTheme`, botón `#theme-toggle`, `localStorage["tetris-theme"]`) — la plataforma ya tiene su propia estética CRT neón fija.
- Nueva ruta `app/juego/tetris/jugar/page.tsx`: reproductor dedicado, clon estructural de `app/juego/asteroides/jugar/page.tsx` (mismo HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales). "GUARDAR PUNTUACIÓN" inserta de verdad en `scores` vía `insertScore`, con el mismo flujo que Asteroides: `localStorage["av_last_player_name"]` precarga y se actualiza al guardar.
- Nueva clase CSS `.cover-tetris` en `app/globals.css`.
- Limpieza de listeners de teclado y `requestAnimationFrame` al desmontar el componente.
- El botón "FIN" termina la partida manualmente en cualquier momento; perder la única vida también termina la partida automáticamente — ambos casos abren el mismo modal de fin con el puntaje acumulado.
- **Auto-descubrimiento (heredado de SPEC 06, sin cambios de código):** al existir la fila `tetris` en `games`, el sidebar "MEJORES PUNTUACIONES" de Detalle y ambas vistas de `/salon` (global + nuevo tab "TETRIS") muestran automáticamente el top 10 real de `scores` filtrado por `game_id: "tetris"`. Informativo — no requiere ninguna decisión ni implementación adicional en este spec.

**Out of scope (para futuras specs):**

- Reutilizar o modificar `asteroides` — queda igual, sin tocarse.
- Cualquier otro juego real del catálogo (Arkanoid u otros) — spec futura si se decide implementar.
- Panel lateral HTML de "siguiente pieza"/controles/tema del original — se descarta como DOM; el preview de "siguiente pieza" se integra dentro del único `<canvas>` (ver Notas de portado del motor).
- Generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06.
- Soporte táctil/móvil.
- Sonido/audio (el original tampoco lo tiene).
- Tema claro/oscuro y su toggle.
- Modificar `references/started-games/03-tetris/` (queda como referencia intacta).
- RLS, paginación, autenticación real — ya fuera de alcance desde SPEC 06.

## Data model

**1. Nueva fila en `games`** (vía migración Supabase):

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'tetris',
  'TETRIS',
  'Encaja piezas descendentes antes de que se acumulen.',
  'Piezas de siete formas caen sin parar sobre un tablero de 10×20. Rota, desliza y encaja para completar líneas y sumar puntos: cuantas más limpies a la vez, más vale cada una. La velocidad aumenta con cada nivel — pierdes si una pieza nueva no cabe al aparecer.',
  'PUZZLE',
  'cover-tetris',
  'yellow'
);
```

No hay columnas `best`/`plays` — se calculan en consulta (`lib/supabase/games.ts::withStats`), igual que el resto del catálogo.

**2. Props de `TetrisGame`** (`components/games/TetrisGame.tsx`):

```ts
interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- **Mapeo de HUD:**
  - `onScoreChange` → `score` real del motor (`LINE_SCORES[cleared] × level` al limpiar líneas, +2/celda en hard drop, +1/fila en soft drop — idéntico al original).
  - `onLivesChange` → `1` al iniciar la partida, `0` en el instante en que `spawn()` detecta colisión (game over). Tetris tiene exactamente 1 vida.
  - `onLevelChange` → `level` real (`Math.floor(lines / 10) + 1`, idéntico al original).
- Reinicio: sin prop `restart`; la página fuerza remount pasando `key={runId}` distinto, igual que `AsteroidsGame`.
- Los callbacks se disparan solo cuando el valor cambia respecto al último notificado (mismo patrón `notifyState` con diffing que Asteroides), no en cada frame.

**3. Estado local de `app/juego/tetris/jugar/page.tsx`** (mismos nombres que `asteroides/jugar/page.tsx`, adaptando el valor inicial de `lives`):

```ts
const GAME_ID = "tetris";
const GAME_TITLE = "TETRIS";
const LAST_PLAYER_NAME_KEY = "av_last_player_name"; // misma key global, no una nueva por juego

const [score, setScore] = useState(0);
const [lives, setLives] = useState(1); // Tetris: 1 vida
const [level, setLevel] = useState(1);
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [runId, setRunId] = useState(0);
const [name, setName] = useState(() =>
  typeof window === "undefined"
    ? (user ?? "INVITADO")
    : (localStorage.getItem(LAST_PLAYER_NAME_KEY) ?? user ?? "INVITADO"),
);
const [saved, setSaved] = useState(false);
const [saving, setSaving] = useState(false);
```

`onGameOver(finalScore)` y el botón "FIN" hacen lo mismo: `setFinalScore(finalScore); setOver(true)` — idéntico a Asteroides.

## Notas de portado del motor

- **Origen**: `references/started-games/03-tetris/game.js` (~332 líneas), estilo **procedural** (funciones globales `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `draw`, `drawBlock`, `drawGrid`, `drawNext`, `loop`, `init`), a diferencia del estilo OOP (clases) de `AsteroidsGame`. El patrón de port (un único `useEffect([])`, `canvasRef`, `pausedRef`/`callbacksRef`, listeners con cleanup, `requestAnimationFrame`) es el mismo; solo cambia que el cuerpo del motor son funciones dentro del closure del effect en vez de clases a nivel de módulo.
- **Canvas**: el original usa **2** (`#board` 300×600 + `#next-canvas` 120×120). Se combinan en **un único `<canvas>` de 800×600** (misma resolución que `AsteroidsGame`, para mantener el mismo comportamiento de escalado CSS dentro de `.crt-screen`): el tablero (300×600, `BLOCK=30` sin cambios) se dibuja a la izquierda; a la derecha, en el espacio restante, se dibuja el preview de "siguiente pieza" (reutilizando la lógica de `drawNext`) junto con el HUD interno del canvas (SCORE/LINES/LEVEL, doble HUD igual que Asteroides — SPEC 05).
- **Assets/archivos extra**: `style.css` del original **no se porta como archivo**. Es tema visual de la página standalone (fondo, panel lateral, overlay, toggle) — todo eso se descarta o se reemplaza por el HUD/CRT de la plataforma. El único detalle a resolver en implementación: `drawGrid()` en el original lee el color de línea con `getComputedStyle(document.body).getPropertyValue('--grid-line')`; al no existir esa variable CSS en este contexto, se reemplaza por un color fijo acorde a la paleta neón existente (`app/globals.css`), a definir en la implementación.
- **Overlays/reinicio internos a eliminar**: overlay DOM `#overlay`/`#overlay-title`/`#overlay-score` (usado para PAUSA y GAME OVER) + botón `#restart-btn` (`onclick: init()`) + atajo de teclado `KeyP` (pausa interna vía `togglePause()`) — los tres se eliminan por completo. La pausa queda exclusiva de la prop `paused`; el fin de partida y el reinicio quedan exclusivos del modal de React (`onGameOver` + remount por `key={runId}`), mismo criterio que SPEC 05.
- **Controles conservados** (con `preventDefault()` en `keydown`): `ArrowLeft`/`ArrowRight` (mover), `ArrowUp` o `KeyX` (rotar, `tryRotate`), `ArrowDown` (soft drop), `Space` (hard drop). `KeyX` no requiere `preventDefault` (no hace scroll).
- **Condición de game over**: se conserva intacta de `spawn()` — cuando la pieza `next` recién asignada a `current` colisiona en su posición inicial (`collide(current.shape, current.x, current.y)` es `true`), en vez de llamar a `endGame()` (que dibujaba el overlay DOM) se invoca `onGameOver(score)` una sola vez (con guard, igual patrón que `killShip()` en Asteroides).

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): insertar la fila de `tetris` en `games` según el Data model. Verificar con `execute_sql`/`list_tables` que la fila existe.
2. Agregar la clase CSS `.cover-tetris` a `app/globals.css`, siguiendo el mismo patrón visual que `.cover-asteroides`/`.cover-rocas` (gradiente radial + siluetas vía `::after`/`::before`), como variante propia e independiente (paleta amarilla, siluetas de tetraminos en vez de rocas/nave).
3. Crear `components/games/TetrisGame.tsx` ("use client"): portar el motor completo de `references/started-games/03-tetris/game.js` (ver Notas de portado del motor) al cuerpo del componente, dentro de un único `useEffect([])` con cleanup. `canvasRef` vía `useRef` apuntando a un `<canvas>` de 800×600 (tablero + preview de siguiente pieza + HUD interno combinados). `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios. Listeners `keydown`/`keyup` con `preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Space`. Se elimina el overlay DOM, el botón de reinicio y el atajo `KeyP` del original. `onGameOver(score)` se dispara una vez, en el instante en que `spawn()` detecta colisión. Los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange` se disparan solo cuando el valor cambia.
4. Crear `app/juego/tetris/jugar/page.tsx` como ruta estática (sin `params`), clonando la estructura de `app/juego/asteroides/jugar/page.tsx` (HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales, `insertScore`, `localStorage["av_last_player_name"]`), con `lives` inicializado en `1` en vez de `3`. Dentro de `.crt-screen`, renderizar `<TetrisGame key={runId} paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setFinalScore(finalScore); setOver(true); }} />`.
5. Verificar: correr el chequeo de tipos (`tsc --noEmit`) y `npm run build` sin errores. Probar manualmente en el navegador: `/juego/tetris` muestra la nueva card con su cover; "JUGAR AHORA" navega a `/juego/tetris/jugar` confirmando que la ruta estática gana precedencia sobre `/juego/[id]/jugar`; los controles (`←`/`→`/`↑` o `X`/`↓`/`Espacio`) responden sin scrollear la página; el HUD superior de React se mantiene sincronizado con el HUD interno del canvas; "PAUSA" congela pieza/tablero; "FIN" y perder la única vida (pieza que no cabe al aparecer) abren el mismo modal con el puntaje correcto; "JUGAR DE NUEVO" reinicia una partida limpia (tablero vacío, pieza centrada, nivel 1, puntaje 0); "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` y aparece en el sidebar de Detalle y en ambas vistas de `/salon` (global + nuevo tab "TETRIS"); salir/navegar fuera no deja listeners ni `requestAnimationFrame` huérfanos; `/juego/asteroides` y el resto de la plataforma no cambian de comportamiento.

## Acceptance criteria

- [ ] `games` en Supabase contiene una fila con `id: "tetris"` (`title: "TETRIS"`, `cat: "PUZZLE"`, `cover: "cover-tetris"`, `color: "yellow"`); la fila `asteroides` no cambió.
- [ ] `app/globals.css` define `.cover-tetris` y la card de "tetris" en Biblioteca/Home muestra ese cover (distinto del de asteroides).
- [ ] `/juego/tetris` (Detalle) carga sin errores, muestra la info del juego, y el botón "JUGAR AHORA" navega a `/juego/tetris/jugar`.
- [ ] `/juego/tetris/jugar` resuelve la ruta estática dedicada `app/juego/tetris/jugar/page.tsx` (no la genérica `app/juego/[id]/jugar/page.tsx`).
- [ ] En `/juego/tetris/jugar` se ve un `<canvas>` con el juego real corriendo (tablero, pieza cayendo, preview de siguiente pieza) en vez de divs decorativos.
- [ ] Las flechas mueven/rotan/bajan la pieza (`←`/`→` mover, `↑` o `X` rotar, `↓` soft drop), `Espacio` hace hard drop, y ninguna de estas teclas scrollea la página.
- [ ] El HUD superior de React (Puntuación, Vidas, Nivel) se actualiza en tiempo real reflejando el estado real del juego.
- [ ] El HUD interno del canvas (score/líneas/nivel, preview de siguiente pieza) se sigue dibujando dentro del canvas, sin duplicar el overlay de game over.
- [ ] El canvas ya no dibuja su propio overlay DOM de PAUSA/GAME OVER; esos estados se reflejan solo vía React (overlay de pausa + modal de fin).
- [ ] La tecla `P` ya no pausa el juego internamente — la pausa depende exclusivamente del botón PAUSA/REANUDAR de React.
- [ ] El botón "PAUSA" congela el tablero/pieza (no siguen cayendo detrás del overlay "EN PAUSA"); "REANUDAR" retoma exactamente donde quedó.
- [ ] El botón "FIN" abre el modal de fin de partida en cualquier momento, con el puntaje acumulado hasta ese instante.
- [ ] Que una pieza nueva no quepa al aparecer (`spawn()` colisiona) abre automáticamente el mismo modal de fin de partida, con el puntaje final correcto, sin necesidad de tocar "FIN".
- [ ] "GUARDAR PUNTUACIÓN" en el modal inserta una fila real en `scores` (`game_id: "tetris"`, `player_name`, `score`, `user_id: null`), verificable con `execute_sql`; el input "TUS INICIALES" se precarga desde `localStorage["av_last_player_name"]`.
- [ ] "JUGAR DE NUEVO" reinicia una partida completamente nueva del motor real (tablero vacío, pieza centrada, nivel 1, puntaje 0) y cierra el modal.
- [ ] "SALIR" navega a `/juego/tetris` y detiene el juego (sin errores de consola por listeners/`requestAnimationFrame` huérfanos tras desmontar).
- [ ] Tras guardar el primer puntaje, `tetris` aparece automáticamente en el sidebar "MEJORES PUNTUACIONES" de Detalle y en `/salon` (vista global + nuevo tab "TETRIS"), sin ningún cambio de código en esas pantallas (heredado de SPEC 06).
- [ ] `/juego/asteroides` y el resto de la plataforma siguen funcionando sin ningún cambio de comportamiento.
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** crear una entrada nueva `tetris` en `games`, separada de `asteroides`. Mismo criterio que SPEC 05 (juegos reales aislados entre sí, sin mezclar).
- **Sí:** `cat: "PUZZLE"` — único hueco libre del enum de categorías (`asteroides` ya ocupa `SHOOTER`).
- **Sí:** `color: "yellow"`, para diferenciarlo visualmente de `cyan` (asteroides) en el catálogo. Decisión explícita del usuario.
- **Sí:** Tetris tiene **1 vida** — se pierde (y termina el juego) cuando una pieza nueva no cabe al aparecer. Decisión explícita del usuario, en lugar de repurponer el stat "Vidas" del HUD para mostrar líneas eliminadas (alternativa descartada).
- **Sí:** combinar los 2 `<canvas>` del original (tablero 300×600 + preview 120×120) en un único `<canvas>` de 800×600 — misma resolución que `AsteroidsGame`, para mantener consistencia en el escalado CSS dentro de `.crt-screen`.
- **No:** portar `style.css` del original como archivo. Es tema visual de la página standalone (fondo, panel lateral, overlay); se descarta y lo reemplaza la estética CRT/HUD ya existente de la plataforma. El color de línea de grid (`--grid-line` en el original) se hardcodea en la implementación en vez de leer una variable CSS que no existe en este contexto.
- **No:** toggle de tema claro/oscuro del original (`applyTheme`, `#theme-toggle`, `localStorage["tetris-theme"]`). La plataforma ya tiene su propia estética CRT neón fija. Decisión explícita del usuario.
- **Sí:** se elimina la tecla `P` (pausa interna), el overlay DOM de PAUSA/GAME OVER y el botón `#restart-btn` del motor original — mismo criterio que SPEC 05 con el overlay de canvas de Asteroides. Decisión explícita del usuario ("como asteroides").
- **Sí:** `endGame()` del original se sustituye por `onGameOver(score)`, disparado en el mismo instante en que `spawn()` detecta colisión — la condición de derrota se mantiene intacta del motor original; solo cambia el canal de notificación (React en vez de un overlay DOM).
- **Sí:** guardado real de puntuación en Supabase vía `insertScore`, con el mismo flujo que Asteroides (modal pide nombre, `localStorage["av_last_player_name"]` — misma key global compartida entre juegos, no una nueva por juego). Decisión explícita del usuario.
- **Sí:** el leaderboard (sidebar de Detalle y ambas vistas de `/salon`) hereda el comportamiento ya establecido en SPEC 06 (top 10 fijo, tabs/filas auto-descubiertas desde `games`) sin ningún cambio de código en esas pantallas — puramente informativo en este spec.
- **No:** generalizar infraestructura reusable para "juegos con motor real" más allá de lo que ya generalizaron SPEC 05/06. Cada juego real sigue siendo su propio spec puntual.
- **No:** soporte táctil/móvil ni sonido/audio — el original no los tiene y no están en alcance.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                                                                                                                     | Mitigation                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La precedencia de rutas estáticas sobre dinámicas (`app/juego/tetris/jugar` vs `app/juego/[id]/jugar`) ya se validó en SPEC 05 para Asteroides, pero es una verificación por-ruta, no una garantía global de Next.js.                                                                                                                                                                    | Confirmar en la práctica al implementar el paso 4 (`/juego/tetris/jugar` resuelve el archivo estático, no el genérico), igual que se hizo en SPEC 05.                                                                                                   |
| El motor original nunca combinó tablero + preview en un solo `<canvas>` (siempre fueron 2 elementos DOM separados); no hay referencia pixel-a-pixel que copiar para el layout combinado.                                                                                                                                                                                                 | El layout (posición del tablero a la izquierda, preview + HUD interno a la derecha dentro del mismo canvas de 800×600) se diseña de cero en la implementación, siguiendo el patrón visual ya usado por `AsteroidsGame` (HUD interno en una esquina).    |
| El acumulador de caída (`dropAccum`) del original avanza con el `dt` de cada frame; si al pausar (`paused=true`) se sigue calculando `dt` desde el último timestamp real sin resetear el acumulador, al reanudar podría dispararse una caída de pieza instantánea por el tiempo "fantasma" acumulado durante la pausa.                                                                   | Igual que `AsteroidsGame`, calcular `dt` con clamp (`Math.min(..., 0.05)`) y **no** avanzar `dropAccum` en los frames donde `paused === true` (se sigue llamando `draw()`, pero se salta tanto `update` como la acumulación del temporizador de caída). |
| Portar `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval` (variables globales `let` del original) a variables de closure dentro de un único `useEffect([])` implica revisar cada función procedural (`spawn`, `lockPiece`, `clearLines`, etc.) para confirmar que ninguna quedó referenciando el scope global del script original. | Revisión manual función por función durante el port (mismo riesgo aceptado y mitigado en SPEC 05 al portar las clases de Asteroids).                                                                                                                    |

## What is **not** in this spec

- Reutilizar o modificar `asteroides`.
- Cualquier otro juego real del catálogo (Arkanoid u otros).
- Panel lateral HTML de "siguiente pieza"/controles/tema del original.
- Generalizar un patrón/infraestructura reusable para "juegos con motor real".
- Soporte táctil/móvil.
- Sonido/audio.
- Tema claro/oscuro y su toggle.
- Cambios a `references/started-games/03-tetris/`.

Cada uno de estos, si se implementa, va en su propia spec.
