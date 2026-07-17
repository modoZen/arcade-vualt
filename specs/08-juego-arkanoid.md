# SPEC 08 — Juego real de Arkanoid

> **Status:** Implementado
> **Depends on:** SPEC 05 (juego real de Asteroides, motor de referencia), SPEC 06 (catálogo y leaderboard reales en Supabase)
> **Date:** 2026-07-17
> **Objective:** Agregar el juego real de Arkanoid (portado desde `references/started-games/04-arkanoid/game.js`) como una nueva entrada `arkanoid` en el catálogo, con su propio Reproductor dedicado en `/juego/arkanoid/jugar`, sincronizando el motor (paleta, pelota, bloques, 5 niveles, spritesheet) con el HUD, el leaderboard y los controles existentes.

## Scope

**In:**

- Nueva fila `arkanoid` en la tabla `games` de Supabase (independiente de `asteroides`/`tetris`), insertada vía `mcp__supabase__apply_migration`.
- Componente `components/games/ArkanoidGame.tsx` ("use client"): encapsula el motor completo portado de `references/started-games/04-arkanoid/game.js` (funciones `initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update`, `draw`, `drawOverlay`) dentro de un único `<canvas>` propio (800×600, misma resolución que `AsteroidsGame`/`TetrisGame`), escalado por CSS al contenedor `.crt-screen` existente.
- Los 5 niveles y sus patrones de bloques (`LEVELS`, portados desde `references/started-games/04-arkanoid/levels.js`) se incluyen íntegros dentro del componente, sin cambios de diseño.
- El componente acepta las mismas 5 props que `AsteroidsGame`/`TetrisGame`: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- **Assets portados a `public/games/arkanoid/`**: el spritesheet `assets/spritesheet-breakout.png` (paleta, pelota, bloques por color, frames de explosión) y los dos efectos de sonido `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3`, cargados y reproducidos igual que en el original (`loadSpritesheet`/`drawSprite`/`drawFrame`, `Audio(...).cloneNode().play()`).
- **Controles**: paleta movible con `ArrowLeft`/`ArrowRight` (con `preventDefault()`) **y** con el mouse (`mousemove` sobre el canvas), igual que el original — decisión explícita del usuario de conservar ambos esquemas.
- Arkanoid tiene **3 vidas** (`lives` arranca en 3, igual que el original): `onLivesChange` reporta `3` al iniciar la partida y decrece cada vez que la pelota cae fuera de la paleta (`ball.y > canvas.height`); llega a `0` cuando se pierde la última.
- `onLevelChange` reporta `currentLevel` (1–5), que avanza automáticamente al destruir todos los bloques vivos de un nivel (`loadLevel(currentLevel + 1)`).
- Completar el nivel 5 (estado `win` del original) **y** perder las 3 vidas (estado `gameover` del original) disparan `onGameOver(score)` de la misma forma — sin distinción visual entre victoria y derrota; ambos casos abren el mismo modal de React con el puntaje final. Decisión explícita del usuario, mismo patrón simple que Asteroides/Tetris.
- Se elimina el `drawOverlay()` del motor original (usado para `'GAME OVER'` y `'¡Completaste el juego!'`) — el modal de React lo reemplaza por completo.
- Se elimina `drawPauseOverlay()` y el listener `canvas.addEventListener('click', ...)` que permitía saltar directamente a cualquiera de los 5 niveles estando en pausa — sin overlay interno no hay dónde dibujar esos botones, y saltar de nivel no es parte del contrato de HUD. Decisión explícita del usuario.
- Se elimina la pausa interna por teclado (`P`/`Escape` → `isPaused = !isPaused`) — la pausa pasa a estar controlada exclusivamente por la prop `paused` desde React, igual que Asteroides/Tetris.
- Nueva ruta `app/juego/arkanoid/jugar/page.tsx`: reproductor dedicado, clon estructural de `app/juego/asteroides/jugar/page.tsx` (mismo HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales). "GUARDAR PUNTUACIÓN" inserta de verdad en `scores` vía `insertScore`, con el mismo flujo que Asteroides/Tetris: `localStorage["av_last_player_name"]` precarga y se actualiza al guardar.
- Nueva clase CSS `.cover-arkanoid` en `app/globals.css`.
- Limpieza de listeners de teclado/mouse y `requestAnimationFrame` al desmontar el componente.
- El botón "FIN" termina la partida manualmente en cualquier momento; perder la última vida o completar el nivel 5 también terminan la partida automáticamente — los tres casos abren el mismo modal de fin con el puntaje acumulado.
- **Auto-descubrimiento (heredado de SPEC 06, sin cambios de código):** al existir la fila `arkanoid` en `games`, el sidebar "MEJORES PUNTUACIONES" de Detalle y ambas vistas de `/salon` (global + nuevo tab "ARKANOID") muestran automáticamente el top 10 real de `scores` filtrado por `game_id: "arkanoid"`. Informativo — no requiere ninguna decisión ni implementación adicional en este spec.

**Out of scope (para futuras specs):**

- Reutilizar o modificar `asteroides`/`tetris` — quedan igual, sin tocarse.
- Cualquier otro juego real del catálogo — spec futura si se decide implementar.
- Generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06.
- Soporte táctil/móvil (el original tampoco lo tiene).
- El mensaje visual distinto de "¡Completaste el juego!" vs "GAME OVER" — ambos casos convergen en el mismo modal de React sin distinguir victoria/derrota (ver Decisions).
- Saltar directamente a un nivel específico (`loadLevel(n)` manual) — se elimina junto con `drawPauseOverlay()`.
- Tema claro/oscuro (el original tampoco lo tiene).
- Modificar `references/started-games/04-arkanoid/` (queda como referencia intacta).
- RLS, paginación, autenticación real — ya fuera de alcance desde SPEC 06.

## Data model

**1. Nueva fila en `games`** (vía migración Supabase):

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'arkanoid',
  'ARKANOID',
  'Destruye hileras de bloques con tu paleta y una pelota que rebota.',
  'Controla una paleta para hacer rebotar una pelota y destruir los bloques de 5 niveles distintos. Cada bloque roto suma puntos; pierdes una vida si la pelota cae fuera de la paleta. Completa los 5 niveles para ganar — la partida también termina si pierdes las 3 vidas.',
  'ARCADE',
  'cover-arkanoid',
  'green'
);
```

No hay columnas `best`/`plays` — se calculan en consulta (`lib/supabase/games.ts::withStats`), igual que el resto del catálogo.

**2. Props de `ArkanoidGame`** (`components/games/ArkanoidGame.tsx`):

```ts
interface ArkanoidGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- **Mapeo de HUD:**
  - `onScoreChange` → `score` real del motor (+10 por bloque destruido, idéntico al original; no hay puntos por rebote de pared/paleta).
  - `onLivesChange` → `lives` real del motor. Arranca en `3`; decrece cada vez que la pelota cae fuera de la paleta (`ball.y > canvas.height`); llega a `0` en el instante del game over.
  - `onLevelChange` → `currentLevel` real (1–5), avanza cuando todos los bloques vivos del nivel activo quedan destruidos.
- Reinicio: sin prop `restart`; la página fuerza remount pasando `key={runId}` distinto, igual que `AsteroidsGame`/`TetrisGame`.
- Los callbacks se disparan solo cuando el valor cambia respecto al último notificado (mismo patrón `notifyState` con diffing), no en cada frame. `onGameOver(score)` se dispara una sola vez (con guard), tanto al perder la última vida como al completar el nivel 5 (ver Decisions).

**3. Estado local de `app/juego/arkanoid/jugar/page.tsx`** (mismos nombres que `asteroides/jugar/page.tsx`):

```ts
const GAME_ID = "arkanoid";
const GAME_TITLE = "ARKANOID";
const LAST_PLAYER_NAME_KEY = "av_last_player_name"; // misma key global, no una nueva por juego

const [score, setScore] = useState(0);
const [lives, setLives] = useState(3); // Arkanoid: 3 vidas, igual que el original
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

`onGameOver(finalScore)` y el botón "FIN" hacen lo mismo: `setFinalScore(finalScore); setOver(true)` — idéntico a Asteroides/Tetris.

## Notas de portado del motor

- **Origen**: `references/started-games/04-arkanoid/game.js` (~269 líneas) + `levels.js` (~50 líneas, define `LEVELS`) + `assets/spritesheet.js` (~67 líneas, loader y helpers de dibujo), estilo **procedural** (funciones globales `initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update`, `draw`, `drawOverlay`, `drawPauseOverlay`, `loop`), igual estilo que Tetris (a diferencia del estilo OOP de `AsteroidsGame`). Mismo patrón de port que Tetris/Asteroides (un único `useEffect([])`, `canvasRef`, `pausedRef`/`callbacksRef`, listeners con cleanup, `requestAnimationFrame`); el cuerpo del motor son funciones dentro del closure del effect.
- **Canvas**: **1** solo `<canvas>` de 800×600 (misma resolución que `AsteroidsGame`/`TetrisGame`) — a diferencia de Tetris, el original de Arkanoid ya usa un único canvas, sin combinación necesaria.
- **`levels.js` (`LEVELS`)**: se porta íntegro como constante dentro del componente (5 niveles con `blocks[]` y `ballSpeedMultiplier`/`speed`), sin cambiar el diseño de ningún nivel.
- **Assets a portar a `public/games/arkanoid/`**:
  - `assets/spritesheet-breakout.png` → `public/games/arkanoid/spritesheet-breakout.png`. Se porta `loadSpritesheet`/`drawSprite`/`drawFrame`/`SPRITES`/`EXPLOSION_FRAMES`/`EXPLOSION_DURATION` de `assets/spritesheet.js` tal cual, ajustando la ruta de carga de la imagen a `/games/arkanoid/spritesheet-breakout.png` (servida por Next.js desde `public/`).
  - `assets/sounds/ball-bounce.mp3` → `public/games/arkanoid/sounds/ball-bounce.mp3`.
  - `assets/sounds/break-sound.mp3` → `public/games/arkanoid/sounds/break-sound.mp3`.
  - Se reproducen con `new Audio(...)` + `.cloneNode().play()` en los mismos eventos que el original (rebote en pared/paleta, bloque destruido) — decisión explícita del usuario de incluir audio en este spec (a diferencia de Asteroides/Tetris).
- **Overlays/reinicio internos a eliminar**: `drawOverlay()` (usado para `'GAME OVER'` y `'¡Completaste el juego!'`), `drawPauseOverlay()` + el listener `canvas.addEventListener('click', ...)` que saltaba de nivel en pausa, y el toggle de pausa interno por teclado (`keydown` con `'p'`/`'P'`/`'Escape'` → `isPaused = !isPaused`) — los tres se eliminan por completo. La pausa queda exclusiva de la prop `paused`; el fin de partida y el reinicio quedan exclusivos del modal de React (`onGameOver` + remount por `key={runId}`), mismo criterio que SPEC 05/07.
- **Controles conservados**: `ArrowLeft`/`ArrowRight` (mover paleta, con `preventDefault()` en `keydown` para no scrollear la página) **y** `mousemove` sobre el canvas (mover paleta directamente a la posición del cursor, sin `preventDefault()` — el mouse no scrollea la página). A diferencia del original (que mueve la paleta por mouse en cualquier momento, incluso con `isPaused === true`), en el port el movimiento por mouse **también respeta `pausedRef.current`** — si `paused` es `true`, mover el mouse no desliza la paleta detrás del overlay "EN PAUSA" (mismo criterio de congelamiento total que ya aplica a las flechas y al resto del motor). Decisión de consistencia interna, ver Decisions.
- **Condición de game over / victoria**: se conservan intactas de `update()` — cuando `ball.y > canvas.height` y `lives` llega a `0` (game over), o cuando se destruyen todos los bloques del nivel 5 (`gameState = 'win'` en el original), en ambos casos se invoca `onGameOver(score)` una sola vez (con guard, igual patrón que `killShip()`/`spawn()` en Asteroides/Tetris) en vez de `drawOverlay('GAME OVER')`/`drawOverlay('¡Completaste el juego!')`.

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): insertar la fila de `arkanoid` en `games` según el Data model. Verificar con `execute_sql`/`list_tables` que la fila existe y que `asteroides`/`tetris` no cambiaron.
2. Copiar los assets del original a `public/games/arkanoid/`: `spritesheet-breakout.png`, `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3` (ver Notas de portado del motor). No se modifica `references/started-games/04-arkanoid/`, que queda intacta como referencia.
3. Agregar la clase CSS `.cover-arkanoid` a `app/globals.css`, siguiendo el mismo patrón visual que `.cover-asteroides`/`.cover-tetris` (gradiente radial + siluetas vía `::after`/`::before`), como variante propia (paleta verde, siluetas de paleta/pelota/bloques en vez de rocas/nave o tetraminos).
4. Crear `components/games/ArkanoidGame.tsx` ("use client"): portar el motor completo de `references/started-games/04-arkanoid/game.js` (ver Notas de portado del motor) al cuerpo del componente, dentro de un único `useEffect([])` con cleanup. `canvasRef` vía `useRef` apuntando a un `<canvas>` de 800×600. `LEVELS` portado desde `levels.js` como constante del módulo. El loader de spritesheet (`loadSpritesheet`/`drawSprite`/`drawFrame`/`SPRITES`/`EXPLOSION_FRAMES`) y los dos `Audio` de sonido se inicializan dentro del mismo efecto, apuntando a las rutas en `public/games/arkanoid/`. `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios. Listeners `keydown`/`keyup` (con `preventDefault()` en `ArrowLeft`/`ArrowRight`) y `mousemove` sobre el canvas para mover la paleta (gateado por `pausedRef.current`, ver Notas de portado). Se elimina `drawOverlay`, `drawPauseOverlay`, el listener de `click` para saltar de nivel, y el toggle de pausa por teclado (`P`/`Escape`) del original. `onGameOver(score)` se dispara una vez, tanto al perder la última vida como al completar el nivel 5. Los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange` se disparan solo cuando el valor cambia.
5. Crear `app/juego/arkanoid/jugar/page.tsx` como ruta estática (sin `params`), clonando la estructura de `app/juego/asteroides/jugar/page.tsx` (HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales, `insertScore`, `localStorage["av_last_player_name"]`), con `lives` inicializado en `3`. Dentro de `.crt-screen`, renderizar `<ArkanoidGame key={runId} paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setFinalScore(finalScore); setOver(true); }} />`.
6. Verificar: correr el chequeo de tipos (`tsc --noEmit`) y `npm run build` sin errores (confirmar que los assets de `public/games/arkanoid/` se sirven correctamente). Probar manualmente en el navegador: `/juego/arkanoid` muestra la nueva card con su cover; "JUGAR AHORA" navega a `/juego/arkanoid/jugar` confirmando que la ruta estática gana precedencia sobre `/juego/[id]/jugar`; la paleta responde tanto a `←`/`→` (sin scrollear la página) como al mouse; el spritesheet se ve correctamente (paleta, pelota, bloques por color) y las explosiones de bloque animan sus 4 frames; los sonidos de rebote y de bloque destruido se escuchan; el HUD superior de React se mantiene sincronizado con el HUD interno del canvas; "PAUSA" congela paleta/pelota/bloques (incluso moviendo el mouse); "FIN", perder la tercera vida, y completar el nivel 5 abren el mismo modal con el puntaje correcto; "JUGAR DE NUEVO" reinicia una partida limpia (nivel 1, 3 vidas, puntaje 0); "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` y aparece en el sidebar de Detalle y en ambas vistas de `/salon` (global + nuevo tab "ARKANOID"); salir/navegar fuera no deja listeners ni `requestAnimationFrame` huérfanos; `/juego/asteroides`, `/juego/tetris` y el resto de la plataforma no cambian de comportamiento.

## Acceptance criteria

- [x] `games` en Supabase contiene una fila con `id: "arkanoid"` (`title: "ARKANOID"`, `cat: "ARCADE"`, `cover: "cover-arkanoid"`, `color: "green"`); las filas `asteroides`/`tetris` no cambiaron.
- [x] `public/games/arkanoid/` contiene `spritesheet-breakout.png`, `sounds/ball-bounce.mp3` y `sounds/break-sound.mp3`.
- [x] `app/globals.css` define `.cover-arkanoid` y la card de "arkanoid" en Biblioteca/Home muestra ese cover (distinto del de asteroides/tetris).
- [x] `/juego/arkanoid` (Detalle) carga sin errores, muestra la info del juego, y el botón "JUGAR AHORA" navega a `/juego/arkanoid/jugar`.
- [x] `/juego/arkanoid/jugar` resuelve la ruta estática dedicada `app/juego/arkanoid/jugar/page.tsx` (no la genérica `app/juego/[id]/jugar/page.tsx`).
- [x] En `/juego/arkanoid/jugar` se ve un `<canvas>` con el juego real corriendo (paleta, pelota, bloques con sprites) en vez de divs decorativos.
- [x] `←`/`→` mueven la paleta sin scrollear la página; mover el mouse sobre el canvas también mueve la paleta.
- [x] Los bloques se destruyen al ser golpeados por la pelota, con animación de explosión de 4 frames y sonido de rotura; la pelota rebota en paredes/paleta con su sonido correspondiente.
- [x] El HUD superior de React (Puntuación, Vidas, Nivel) se actualiza en tiempo real reflejando el estado real del juego.
- [x] El canvas ya no dibuja su propio overlay DOM/canvas de PAUSA/GAME OVER/WIN; esos estados se reflejan solo vía React (overlay de pausa + modal de fin).
- [x] La tecla `P`/`Escape` ya no pausa el juego internamente — la pausa depende exclusivamente del botón PAUSA/REANUDAR de React.
- [x] Ya no es posible saltar de nivel haciendo click sobre el canvas en pausa.
- [x] El botón "PAUSA" congela paleta/pelota/bloques (incluso moviendo el mouse, no siguen behind el overlay "EN PAUSA"); "REANUDAR" retoma exactamente donde quedó.
- [x] El botón "FIN" abre el modal de fin de partida en cualquier momento, con el puntaje acumulado hasta ese instante.
- [x] Perder la tercera vida (pelota cae fuera de la paleta) abre automáticamente el mismo modal de fin de partida, con el puntaje final correcto, sin necesidad de tocar "FIN".
- [x] Completar el nivel 5 (destruir todos sus bloques) abre automáticamente el mismo modal de fin de partida, con el puntaje final correcto.
- [x] "GUARDAR PUNTUACIÓN" en el modal inserta una fila real en `scores` (`game_id: "arkanoid"`, `player_name`, `score`, `user_id: null`), verificable con `execute_sql`; el input "TUS INICIALES" se precarga desde `localStorage["av_last_player_name"]`.
- [x] "JUGAR DE NUEVO" reinicia una partida completamente nueva del motor real (nivel 1, 3 vidas, puntaje 0, bloques del nivel 1 completos) y cierra el modal.
- [x] "SALIR" navega a `/juego/arkanoid` y detiene el juego (sin errores de consola por listeners/`requestAnimationFrame` huérfanos tras desmontar).
- [x] Tras guardar el primer puntaje, `arkanoid` aparece automáticamente en el sidebar "MEJORES PUNTUACIONES" de Detalle y en `/salon` (vista global + nuevo tab "ARKANOID"), sin ningún cambio de código en esas pantallas (heredado de SPEC 06).
- [x] `/juego/asteroides`, `/juego/tetris` y el resto de la plataforma siguen funcionando sin ningún cambio de comportamiento.
- [x] El chequeo de tipos de TypeScript no reporta errores.
- [x] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** crear una entrada nueva `arkanoid` en `games`, separada de `asteroides`/`tetris`. Mismo criterio que SPEC 05/07 (juegos reales aislados entre sí, sin mezclar).
- **Sí:** `cat: "ARCADE"` — único hueco que calza conceptualmente del enum de categorías (`asteroides` ocupa `SHOOTER`, `tetris` ocupa `PUZZLE`; `VERSUS` no encaja con un juego de un jugador contra bloques). Decisión explícita del usuario.
- **Sí:** `color: "green"`, para diferenciarlo visualmente de `cyan` (asteroides) y `yellow` (tetris) en el catálogo. Decisión explícita del usuario.
- **Sí:** Arkanoid tiene **3 vidas** — se pierde una cuando la pelota cae fuera de la paleta, igual que el motor original; se mantiene el mismo número que el original (no se reinterpreta el stat, a diferencia de Tetris que sí lo reinterpretó a 1 vida).
- **Sí:** conservar **ambos** esquemas de control de paleta (teclado `←`/`→` y mouse), tal cual el original. Decisión explícita del usuario — Arkanoid es el primer juego real del catálogo que soporta mouse, a diferencia de Asteroides/Tetris que son 100% teclado.
- **Sí:** el movimiento de paleta por mouse respeta `pausedRef.current` (no mueve la paleta si `paused === true`), a diferencia del original donde el mouse mueve la paleta incluso en su pausa interna. Decisión de consistencia: evita que la paleta se deslice visualmente detrás del overlay "EN PAUSA" de React, y unifica el criterio de "congelamiento total" ya aplicado a teclado y al resto del motor en Asteroides/Tetris.
- **Sí:** portar el spritesheet original (`assets/spritesheet-breakout.png`) a `public/games/arkanoid/`, en vez de redibujar paleta/pelota/bloques con formas vectoriales (como hacen Asteroides/Tetris). Decisión explícita del usuario — mantiene la fidelidad visual del original (incluidas las animaciones de explosión de bloque) sin reinventar el arte.
- **Sí:** incluir los 2 efectos de sonido del original (`ball-bounce.mp3`, `break-sound.mp3`), portados a `public/games/arkanoid/sounds/`. Decisión explícita del usuario — Arkanoid es el primer juego real del catálogo con audio, a diferencia de Asteroides/Tetris que no lo tienen (el original tampoco lo tenía en esos casos).
- **Sí:** completar el nivel 5 (estado `win` del original) dispara `onGameOver(score)` exactamente igual que perder las 3 vidas (estado `gameover`), sin ningún mensaje o estado visual que distinga victoria de derrota. Decisión explícita del usuario — mantiene el contrato de props simple (5 props ya usado por Asteroides/Tetris) en vez de diseñar un sexto callback o una prop adicional solo para Arkanoid.
- **Sí:** se elimina `drawOverlay()` (game over y win), `drawPauseOverlay()`, el listener de `click` para saltar de nivel en pausa, y el toggle de pausa interno por teclado (`P`/`Escape`) del motor original — mismo criterio que SPEC 05/07 con los overlays de canvas de Asteroides/Tetris. Decisión explícita del usuario.
- **Sí:** saltar directamente a un nivel específico (la función de los botones de `drawPauseOverlay()`) se elimina por completo, sin reemplazo. Decisión explícita del usuario — no es parte del contrato de HUD (`paused`/`score`/`lives`/`level`/`onGameOver`) y agregar un control de React nuevo solo para esto queda fuera de alcance.
- **Sí:** `LEVELS` (los 5 niveles de `levels.js`) se porta íntegro sin cambiar el diseño de ningún nivel ni su multiplicador de velocidad.
- **Sí:** guardado real de puntuación en Supabase vía `insertScore`, con el mismo flujo que Asteroides/Tetris (modal pide nombre, `localStorage["av_last_player_name"]` — misma key global compartida entre juegos, no una nueva por juego). Decisión explícita del usuario.
- **Sí:** el leaderboard (sidebar de Detalle y ambas vistas de `/salon`) hereda el comportamiento ya establecido en SPEC 06 (top 10 fijo, tabs/filas auto-descubiertas desde `games`) sin ningún cambio de código en esas pantallas — puramente informativo en este spec.
- **No:** generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06. Cada juego real sigue siendo su propio spec puntual.
- **No:** soporte táctil/móvil — el original no lo tiene y no está en alcance.
- **No:** modificar `references/started-games/04-arkanoid/` — queda como referencia intacta; los assets se copian a `public/`, no se mueven ni se referencian in situ.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La precedencia de rutas estáticas sobre dinámicas (`app/juego/arkanoid/jugar` vs `app/juego/[id]/jugar`) ya se validó en SPEC 05/07 para Asteroides/Tetris, pero es una verificación por-ruta, no una garantía global de Next.js.                                                                                          | Confirmar en la práctica al implementar el paso 5 (`/juego/arkanoid/jugar` resuelve el archivo estático, no el genérico), igual que se hizo en SPEC 05/07.                                                                                                                                                            |
| El spritesheet se carga de forma asíncrona (`loadSpritesheet(cb)`); si el `useEffect` arranca el loop de `requestAnimationFrame` antes de que la imagen termine de cargar, los primeros frames podrían no dibujar nada (aunque `drawSprite`/`drawFrame` ya son no-op seguros mientras `!ssLoaded`, igual que el original). | Igual que el original: arrancar `requestAnimationFrame(loop)` solo dentro del callback de `loadSpritesheet(...)`, no antes — el `update(dt)` puede seguir corriendo desde el primer frame, pero el render de sprites espera a que la imagen esté lista, sin necesidad de un estado de "cargando" adicional en React.  |
| El canvas se escala por CSS dentro de `.crt-screen` (igual que Asteroides/Tetris); la posición del mouse (`e.clientX`/`e.clientY`) hay que convertirla a coordenadas internas del canvas (800×600) compensando ese escalado, o la paleta no seguirá al cursor con precisión.                                               | Portar el mismo cálculo de `scaleX`/`scaleY` que ya usa el `mousemove` original (`canvas.width / rect.width`), aplicado sobre `canvasRef.current.getBoundingClientRect()`.                                                                                                                                            |
| El acumulador de tiempo (`dt`) del original no tiene clamp; si el tab pierde foco y `requestAnimationFrame` se retrasa, un `dt` grande de golpe podría teletransportar la pelota a través de una pared/bloque sin detectar colisión (tunneling), o mover la paleta de golpe.                                               | Igual que `AsteroidsGame`/`TetrisGame`, calcular `dt` con clamp (`Math.min(..., 0.05)`) antes de pasarlo a `update(dt)`.                                                                                                                                                                                              |
| Los navegadores modernos bloquean el autoplay de audio sin interacción previa del usuario; si `new Audio(...)` intenta reproducir sonido antes de cualquier click/tecla, el navegador podría rechazar la reproducción silenciosamente.                                                                                     | Bajo riesgo real en este flujo: el jugador ya hizo click en "JUGAR AHORA" antes de que el motor arranque, lo que cuenta como interacción previa para la política de autoplay de la mayoría de navegadores. Se acepta como comportamiento igual al original; no se agrega manejo adicional de errores de reproducción. |

## What is **not** in this spec

- Reutilizar o modificar `asteroides`/`tetris`.
- Cualquier otro juego real del catálogo.
- Generalizar un patrón/infraestructura reusable para "juegos con motor real".
- Soporte táctil/móvil.
- Mensaje/estado visual distinto para victoria vs derrota (ambos casos convergen en el mismo modal).
- Saltar directamente a un nivel específico.
- Tema claro/oscuro.
- Cambios a `references/started-games/04-arkanoid/`.

Cada uno de estos, si se implementa, va en su propia spec.
