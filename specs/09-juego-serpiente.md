# SPEC 09 — Juego real de Serpiente

> **Status:** Aprobado
> **Depends on:** SPEC 05 (juego real de Asteroides, motor de referencia), SPEC 06 (catálogo y leaderboard reales en Supabase)
> **Date:** 2026-07-17
> **Objective:** Agregar el juego real de Serpiente (motor creado desde cero, sin `game.js` de referencia, usando el spritesheet de frutas de `references/source-assets/snake-assets/`) como una nueva entrada `serpiente` en el catálogo, con su propio Reproductor dedicado en `/juego/serpiente/jugar`, sincronizando el motor (movimiento por grilla, frutas aleatorias, aceleración por nivel) con el HUD, el leaderboard y los controles existentes.

## Scope

**In:**

- Nueva fila `serpiente` en la tabla `games` de Supabase (independiente de `asteroides`/`tetris`/`arkanoid`), insertada vía `mcp__supabase__apply_migration`.
- Componente `components/games/SerpienteGame.tsx` ("use client"): motor completo de Snake **creado desde cero** (sin `game.js` de referencia) dentro de un único `<canvas>` propio de 600×600, grilla lógica de 20×20 celdas (30px/celda), escalado por CSS al contenedor `.crt-screen` existente.
- Movimiento por grilla (tick discreto, no continuo): la serpiente avanza una celda por intervalo de tiempo, controlado por flechas **y** WASD (con `preventDefault()` en las flechas para no scrollear la página); no se permite invertir dirección 180° sobre el propio cuello.
- Alimento: en cada spawn se elige al azar una fruta del atlas de `references/source-assets/snake-assets/sprites.js` (21 variantes: banana, naranja, uva, ajo, berenjena, fresa, cereza, zanahoria, hongo, brócoli, sandía, pimiento, kiwi, limón, durazno, maní, manzana, tomate, moras, uvas2, piña, melón) y se dibuja con el spritesheet `fruits.png`, portado a `public/games/serpiente/fruits.png`. El atlas de coordenadas se reescribe como constante TS dentro del componente (no se carga `sprites.js` como script).
- Cuerpo y cabeza de la serpiente se dibujan con formas vectoriales de canvas (`fillRect`/similar), sin sprite propio — solo la fruta usa el spritesheet.
- Cada fruta comida: `+100` al puntaje, `+1` segmento de crecimiento, y cuenta para la progresión de nivel.
- Progresión de velocidad: cada 5 frutas comidas sube un nivel (`onLevelChange`), y el intervalo de movimiento se reduce (la serpiente acelera); la curva exacta de aceleración se define en la implementación.
- Choque contra el borde del canvas **o** contra el propio cuerpo termina la partida de inmediato (sin wrap toroidal).
- El componente acepta las mismas 5 props que `AsteroidsGame`/`TetrisGame`/`ArkanoidGame`: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- **Mapeo de HUD** (detalle completo en Data model): `onScoreChange` → puntaje real (frutas × 100); `onLivesChange` → `1` fijo, baja a `0` en el choque final (reinterpretación tipo Tetris, Snake no tiene vidas múltiples); `onLevelChange` → nivel de velocidad real (sube cada 5 frutas).
- Estado inicial/reinicio: serpiente de 3 segmentos, centrada en la grilla, quieta hasta que el jugador presiona la primera tecla de dirección.
- Nueva ruta `app/juego/serpiente/jugar/page.tsx`: reproductor dedicado, clon estructural de `app/juego/asteroides/jugar/page.tsx` (mismo HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales). "GUARDAR PUNTUACIÓN" inserta de verdad en `scores` vía `insertScore`, con `localStorage["av_last_player_name"]`.
- Nueva clase CSS `.cover-serpiente` en `app/globals.css` (color `magenta`).
- Limpieza de listeners de teclado y del loop (`requestAnimationFrame`/`setInterval`, según implementación) al desmontar el componente.
- El botón "FIN" termina la partida manualmente en cualquier momento; chocar contra el borde o contra sí misma también termina la partida automáticamente — ambos casos abren el mismo modal de fin con el puntaje acumulado.
- **Auto-descubrimiento (heredado de SPEC 06, sin cambios de código):** al existir la fila `serpiente` en `games`, el sidebar "MEJORES PUNTUACIONES" de Detalle y ambas vistas de `/salon` (global + nuevo tab "SERPIENTE") muestran automáticamente el top 10 real filtrado por `game_id: "serpiente"`.

**Out of scope (para futuras specs):**

- Reutilizar o modificar `asteroides`/`tetris`/`arkanoid` — quedan igual, sin tocarse.
- Cualquier otro juego real del catálogo — spec futura si se decide implementar.
- Generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06.
- Soporte táctil/móvil (swipe).
- Sonido/audio.
- Wrap toroidal en los bordes (decisión explícita: choque con pared = game over).
- Obstáculos, power-ups, o cualquier mecánica de Snake más allá de fruta + crecimiento + aceleración por nivel.
- Tema claro/oscuro.
- RLS, paginación, autenticación real — ya fuera de alcance desde SPEC 06.

## Data model

**1. Nueva fila en `games`** (vía migración Supabase):

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'serpiente',
  'SERPIENTE',
  'Guía a la serpiente para comer frutas y crecer sin chocar.',
  'Controla una serpiente que se mueve por una grilla. Cada fruta que come (elegida al azar entre 21 variantes) la hace crecer un segmento y suma puntos. La velocidad aumenta cada 5 frutas comidas. La partida termina si choca contra el borde del tablero o contra su propio cuerpo.',
  'ARCADE',
  'cover-serpiente',
  'magenta'
);
```

No hay columnas `best`/`plays` — se calculan en consulta (`lib/supabase/games.ts::withStats`), igual que el resto del catálogo.

**2. Props de `SerpienteGame`** (`components/games/SerpienteGame.tsx`):

```ts
interface SerpienteGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- **Mapeo de HUD:**
  - `onScoreChange` → puntaje real del motor: `frutas comidas × 100`.
  - `onLivesChange` → `1` fijo mientras la partida está viva; pasa a `0` en el instante del choque final (contra pared o contra sí misma). Reinterpretación explícita (Snake no tiene vidas múltiples), mismo criterio que usó Tetris para este stat.
  - `onLevelChange` → nivel de velocidad real, entero que empieza en `1` y sube en `1` cada 5 frutas comidas (reduce el intervalo de movimiento de la serpiente).
- Reinicio: sin prop `restart`; la página fuerza remount pasando `key={runId}` distinto, igual que los demás juegos reales.
- Los callbacks se disparan solo cuando el valor cambia respecto al último notificado (mismo patrón `notifyState` con diffing que Arkanoid/Tetris). `onGameOver(score)` se dispara una sola vez, con guard, en el instante del choque.

**3. Estado local de `app/juego/serpiente/jugar/page.tsx`** (mismos nombres que el resto de los juegos reales):

```ts
const GAME_ID = "serpiente";
const GAME_TITLE = "SERPIENTE";
const LAST_PLAYER_NAME_KEY = "av_last_player_name"; // misma key global compartida

const [score, setScore] = useState(0);
const [lives, setLives] = useState(1); // Serpiente: 1 vida fija (sin sistema de vidas real)
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

`onGameOver(finalScore)` y el botón "FIN" hacen lo mismo: `setFinalScore(finalScore); setOver(true)` — idéntico al resto de los juegos reales.

**4. Atlas de frutas inline** (portado de `references/source-assets/snake-assets/sprites.js` a `components/games/SerpienteGame.tsx`):

```ts
const FRUIT_SHEET_SRC = "/games/serpiente/fruits.png";

const FRUIT_ATLAS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} as const;
```

Fuente de la hoja: 3790×442px, fondo transparente. En cada spawn de fruta se elige una clave al azar de `FRUIT_ATLAS` con `drawImage` recortando su `{x, y, w, h}`.

## Notas de portado del motor

- **Origen**: no hay `game.js` de referencia para Snake en `references/started-games/` — el motor se **crea desde cero**. Lo único que se porta es el asset gráfico: `references/source-assets/snake-assets/fruits.png` (spritesheet de frutas) y las coordenadas de `references/source-assets/snake-assets/sprites.js` (reescritas como constante TS, no cargadas como script — ver Data model, punto 4).
- **Estilo del motor**: sin precedente en el proyecto (Asteroids es OOP, Tetris/Arkanoid son procedurales); se construye siguiendo el mismo patrón general de componente ya usado por los tres (funciones dentro del closure de un único `useEffect([])`, sin necesidad de decidir OOP vs procedural porque no hay código previo que preservar).
- **Canvas**: **1** solo `<canvas>` de 600×600, con una grilla lógica de 20×20 celdas (30px/celda) para el movimiento discreto de la serpiente.
- **Loop de movimiento**: a diferencia de Asteroides/Arkanoid (movimiento continuo por `dt`), Snake se mueve en pasos discretos por celda a intervalo fijo (ej. `setInterval`/acumulador dentro de `requestAnimationFrame`), donde el intervalo se reduce a medida que sube el nivel de velocidad (cada 5 frutas).
- **Assets a portar a `public/games/serpiente/`**: `fruits.png` → `public/games/serpiente/fruits.png`. No hay sonidos ni otros archivos a portar.
- **Overlays/reinicio internos a eliminar**: no aplica — al no existir motor original, no hay overlay de "game over" ni reinicio por tecla que remover. El modal de fin y el remount por `key={runId}` son, desde el inicio, la única forma de terminar/reiniciar una partida (mismo criterio final que SPEC 05/07/08, pero sin nada previo que limpiar).
- **Controles**: `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` **y** `W`/`A`/`S`/`D`, ambos esquemas activos simultáneamente y equivalentes. `preventDefault()` en las 4 flechas (no es necesario en WASD, esas teclas no scrollean la página). Se ignora cualquier tecla que invierta la dirección actual 180° sobre el propio cuello (ej. presionar `ArrowDown` mientras se mueve hacia arriba no hace nada).
- **Condición de derrota**: la cabeza de la serpiente sale de los límites de la grilla (0–19 en ambos ejes) **o** ocupa la misma celda que cualquier segmento de su propio cuerpo → `onGameOver(score)` una sola vez, con guard (mismo patrón que `killShip()`/`spawn()` en los demás juegos reales).

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): insertar la fila de `serpiente` en `games` según el Data model. Verificar con `execute_sql`/`list_tables` que la fila existe y que `asteroides`/`tetris`/`arkanoid` no cambiaron.
2. Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/serpiente/fruits.png`. No se modifica `references/source-assets/snake-assets/`, que queda intacta como referencia.
3. Agregar la clase CSS `.cover-serpiente` a `app/globals.css`, siguiendo el mismo patrón visual que `.cover-asteroides`/`.cover-tetris`/`.cover-arkanoid` (gradiente radial + siluetas vía `::after`/`::before`), como variante propia (paleta magenta, silueta de serpiente/cuadrícula en vez de rocas/tetraminos/paleta).
4. Crear `components/games/SerpienteGame.tsx` ("use client"): motor desde cero dentro de un único `useEffect([])` con cleanup. `canvasRef` vía `useRef` apuntando a un `<canvas>` de 600×600 (grilla 20×20, 30px/celda). `FRUIT_ATLAS` y `FRUIT_SHEET_SRC` como constantes del módulo (ver Data model, punto 4); la imagen se carga una vez al montar. Estado del motor: array de segmentos `{x, y}`, dirección actual/siguiente, posición de fruta activa (con su clave de `FRUIT_ATLAS` elegida al azar), score, nivel, intervalo de movimiento actual. Movimiento discreto por acumulador de tiempo dentro de `requestAnimationFrame` (avanza una celda cada vez que el acumulador supera el intervalo del nivel actual). `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios, igual patrón que los demás juegos reales. Listeners `keydown` para flechas (con `preventDefault()`) y WASD, con guard de reversión 180°. Al comer fruta: `+100` score, `+1` segmento (no se recorta la cola ese tick), se reubica la fruta en una celda libre al azar con clave aleatoria nueva de `FRUIT_ATLAS`, y cada 5 frutas comidas sube el nivel y reduce el intervalo de movimiento. Colisión con borde o con el propio cuerpo dispara `onGameOver(score)` una sola vez (con guard). `onScoreChange`/`onLivesChange`/`onLevelChange` se disparan solo cuando el valor cambia. `paused` congela el avance por grilla (se sigue dibujando `draw()`, no se consume el acumulador de tiempo).
5. Crear `app/juego/serpiente/jugar/page.tsx` como ruta estática (sin `params`), clonando la estructura de `app/juego/asteroides/jugar/page.tsx` (HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales, `insertScore`, `localStorage["av_last_player_name"]`), con `lives` inicializado en `1`. Dentro de `.crt-screen`, renderizar `<SerpienteGame key={runId} paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setFinalScore(finalScore); setOver(true); }} />`.
6. Verificar: correr el chequeo de tipos (`tsc --noEmit`) y `npm run build` sin errores (confirmar que `public/games/serpiente/fruits.png` se sirve correctamente). Probar manualmente en el navegador: `/juego/serpiente` muestra la nueva card con su cover; "JUGAR AHORA" navega a `/juego/serpiente/jugar` confirmando que la ruta estática gana precedencia sobre `/juego/[id]/jugar`; la serpiente responde a flechas y WASD sin scrollear la página y sin poder invertirse 180°; comer una fruta la hace crecer, suma 100 puntos, y dibuja el sprite recortado correctamente (sin bordes/artefactos del atlas); cada 5 frutas el nivel sube y la serpiente se mueve visiblemente más rápido; chocar contra el borde o contra su propio cuerpo abre el modal de fin con el puntaje correcto; "PAUSA" congela el movimiento; "FIN" abre el modal en cualquier momento; "JUGAR DE NUEVO" reinicia una partida limpia (3 segmentos, centrada, nivel 1, puntaje 0); "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` y aparece en el sidebar de Detalle y en ambas vistas de `/salon` (global + nuevo tab "SERPIENTE"); salir/navegar fuera no deja listeners ni `requestAnimationFrame` huérfanos; el resto del catálogo no cambia de comportamiento.

## Acceptance criteria

- [ ] `games` en Supabase contiene una fila con `id: "serpiente"` (`title: "SERPIENTE"`, `cat: "ARCADE"`, `cover: "cover-serpiente"`, `color: "magenta"`); las filas `asteroides`/`tetris`/`arkanoid` no cambiaron.
- [ ] `public/games/serpiente/fruits.png` existe y se sirve correctamente.
- [ ] `app/globals.css` define `.cover-serpiente` y la card de "serpiente" en Biblioteca/Home muestra ese cover (distinto del de asteroides/tetris/arkanoid).
- [ ] `/juego/serpiente` (Detalle) carga sin errores, muestra la info del juego, y el botón "JUGAR AHORA" navega a `/juego/serpiente/jugar`.
- [ ] `/juego/serpiente/jugar` resuelve la ruta estática dedicada `app/juego/serpiente/jugar/page.tsx` (no la genérica `app/juego/[id]/jugar/page.tsx`).
- [ ] En `/juego/serpiente/jugar` se ve un `<canvas>` con el juego real corriendo (serpiente sobre grilla, fruta con sprite) en vez de divs decorativos.
- [ ] Flechas y WASD mueven la serpiente sin scrollear la página; no es posible invertir la dirección 180° sobre el propio cuello.
- [ ] Comer una fruta hace crecer la serpiente un segmento, suma 100 puntos, y dibuja el sprite recortado del atlas sin artefactos visuales; la siguiente fruta aparece en una celda libre con un sprite elegido al azar.
- [ ] Cada 5 frutas comidas el nivel sube (`onLevelChange`) y el intervalo de movimiento se reduce de forma perceptible.
- [ ] El HUD superior de React (Puntuación, Vidas, Nivel) se actualiza en tiempo real reflejando el estado real del juego; "Vidas" muestra `1` durante la partida y pasa a `0` en el choque final.
- [ ] El canvas no dibuja ningún overlay propio de pausa/game over; esos estados se reflejan solo vía React (overlay de pausa + modal de fin).
- [ ] El botón "PAUSA" congela el avance de la serpiente; "REANUDAR" retoma exactamente donde quedó.
- [ ] El botón "FIN" abre el modal de fin de partida en cualquier momento, con el puntaje acumulado hasta ese instante.
- [ ] Chocar contra el borde del canvas abre automáticamente el modal de fin de partida, con el puntaje final correcto.
- [ ] Chocar contra el propio cuerpo abre automáticamente el modal de fin de partida, con el puntaje final correcto.
- [ ] "GUARDAR PUNTUACIÓN" en el modal inserta una fila real en `scores` (`game_id: "serpiente"`, `player_name`, `score`, `user_id: null`), verificable con `execute_sql`; el input "TUS INICIALES" se precarga desde `localStorage["av_last_player_name"]`.
- [ ] "JUGAR DE NUEVO" reinicia una partida completamente nueva (serpiente de 3 segmentos centrada, quieta hasta la primera tecla, nivel 1, puntaje 0) y cierra el modal.
- [ ] "SALIR" navega a `/juego/serpiente` y detiene el juego (sin errores de consola por listeners/`requestAnimationFrame` huérfanos tras desmontar).
- [ ] Tras guardar el primer puntaje, `serpiente` aparece automáticamente en el sidebar "MEJORES PUNTUACIONES" de Detalle y en `/salon` (vista global + nuevo tab "SERPIENTE"), sin ningún cambio de código en esas pantallas (heredado de SPEC 06).
- [ ] `/juego/asteroides`, `/juego/tetris`, `/juego/arkanoid` y el resto de la plataforma siguen funcionando sin ningún cambio de comportamiento.
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** crear una entrada nueva `serpiente` en `games`, separada de `asteroides`/`tetris`/`arkanoid`. Mismo criterio que SPEC 05/07/08 (juegos reales aislados entre sí, sin mezclar).
- **Sí:** `cat: "ARCADE"`, mismo valor que Arkanoid. Decisión explícita del usuario.
- **Sí:** `color: "magenta"` — único color del enum (cyan/magenta/yellow/green) que ningún otro juego real usaba todavía, evitando repetir acento visual en el catálogo. Decisión explícita del usuario.
- **Sí:** motor creado **desde cero**, sin `game.js` de referencia — a diferencia de Asteroides/Tetris/Arkanoid, no existe una carpeta en `references/started-games/` para Snake. Solo se porta el asset gráfico (`fruits.png` + atlas de `sprites.js`) desde `references/source-assets/snake-assets/`.
- **Sí:** `onScoreChange` = frutas comidas × 100 puntos fijos. Decisión explícita del usuario, mismo criterio de "valor fijo por evento" que usa Arkanoid (+10 por bloque), pero con un múltiplo mayor pedido explícitamente.
- **Sí:** `onLivesChange` = `1` fijo (baja a `0` en el choque final), reinterpretando el stat "vidas" ya que Snake no tiene un sistema de vidas múltiples. Mismo criterio que usó Tetris para este mismo problema (spec 07). Decisión explícita del usuario, descartando la alternativa de ocultar el stat.
- **Sí:** `onLevelChange` = nivel de velocidad real, sube cada 5 frutas comidas y reduce el intervalo de movimiento. Decisión explícita del usuario, descartando la alternativa de nivel constante en 1 (el juego sí tiene progresión de dificultad).
- **Sí:** controles duales, flechas **y** WASD, ambos activos simultáneamente. Decisión explícita del usuario — Snake es el primer juego real del catálogo con doble esquema de teclado (a diferencia de Arkanoid, que combina teclado+mouse pero no dos esquemas de teclado).
- **Sí:** choque contra el borde del canvas termina la partida (sin wrap toroidal), a diferencia del wrap que sí usa Asteroides. Decisión explícita del usuario — es el comportamiento clásico y más reconocible de Snake.
- **Sí:** canvas de 600×600 con grilla de 20×20 (30px/celda), en vez de reusar la resolución 800×600 de los demás juegos reales. Decisión explícita del usuario — un canvas cuadrado es más natural para el movimiento por grilla de Snake que uno 4:3.
- **Sí:** fruta aleatoria por spawn entre las 21 variantes del atlas, en vez de una fruta fija (ej. siempre manzana). Decisión explícita del usuario — aprovecha visualmente todo el spritesheet portado.
- **Sí:** cuerpo/cabeza de la serpiente dibujados como formas vectoriales de canvas, no con sprite propio — solo la fruta usa el spritesheet. Decisión explícita del usuario, descartando buscar/inventar un sprite de cuerpo que no está confirmado en el atlas.
- **Sí:** `fruits.png` se copia a `public/games/serpiente/fruits.png` y las coordenadas de `sprites.js` se reescriben como constante TS inline en el componente, en vez de copiar `sprites.js` tal cual y cargarlo como script o parsearlo en runtime. Decisión explícita del usuario — mismo criterio que usó Arkanoid al portar `assets/spritesheet.js` (los datos se inlinean, no se cargan dinámicamente).
- **Sí:** +100 puntos y +1 segmento de crecimiento por fruta comida. Decisión explícita del usuario.
- **Sí:** progresión de velocidad cada 5 frutas comidas (no cada 10). Decisión explícita del usuario.
- **Sí:** la serpiente arranca con 3 segmentos, centrada en la grilla, quieta hasta la primera tecla de dirección (no se mueve sola desde el frame 1). Decisión explícita del usuario, tanto en la partida inicial como en cada reinicio ("JUGAR DE NUEVO").
- **Sí:** guard de reversión 180° (no se puede girar directamente sobre el propio cuello) — mecánica estándar de Snake no cubierta explícitamente por las preguntas de Fase 2, pero necesaria para que el juego sea jugable; se documenta aquí en vez de asumirla silenciosamente en el código.
- **Sí:** guardado real de puntuación en Supabase vía `insertScore`, con el mismo flujo que los demás juegos reales (modal pide nombre, `localStorage["av_last_player_name"]` — misma key global compartida).
- **No:** generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06. Cada juego real sigue siendo su propio spec puntual.
- **No:** soporte táctil/móvil, sonido, wrap toroidal, obstáculos o power-ups — ninguno pedido por el usuario; quedan fuera de alcance explícito.
- **No:** modificar `references/source-assets/snake-assets/` — queda como referencia intacta; el asset se copia a `public/`, no se mueve ni se referencia in situ.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La precedencia de rutas estáticas sobre dinámicas (`app/juego/serpiente/jugar` vs `app/juego/[id]/jugar`) ya se validó en SPEC 05/07/08, pero es una verificación por-ruta, no una garantía global de Next.js.                                                                                                                             | Confirmar en la práctica al implementar el paso 5 (`/juego/serpiente/jugar` resuelve el archivo estático, no el genérico), igual que se hizo en los specs anteriores.                                                             |
| Flechas y WASD pueden scrollear o activar comportamientos del navegador si falta `preventDefault()` en las flechas.                                                                                                                                                                                                                        | Aplicar `e.preventDefault()` en el listener de `keydown` para `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, igual que en los demás juegos reales; WASD no requiere `preventDefault()`.                                          |
| Al no existir `game.js` de referencia, no hay implementación probada de detección de colisión cabeza-cuerpo ni de reubicación de fruta en celda libre — un bug aquí puede dejar la fruta spawneando encima de la serpiente o colisiones falsas/perdidas.                                                                                   | Verificación manual explícita en el paso 6: comer varias frutas seguidas, confirmar que nunca aparece una fruta sobre un segmento vivo, y que el choque contra el cuerpo se detecta de forma consistente en distintas longitudes. |
| El movimiento discreto por grilla (acumulador de tiempo dentro de `requestAnimationFrame`) es un patrón distinto al de `dt` continuo que usan Asteroides/Arkanoid; un manejo incorrecto del acumulador podría hacer que la serpiente avance más de una celda por tick tras un frame lento (tab en segundo plano), saltándose una colisión. | Clamp del `dt` acumulado (igual criterio que Arkanoid, `Math.min(..., valor máximo)`) antes de sumarlo al acumulador, y consumir el acumulador de a una celda por vez (no en bucle sin límite) en cada frame.                     |
| El atlas de `sprites.js` documenta las coordenadas como "detectadas por análisis de píxeles" (no oficiales del asset original) — podrían tener pequeños desfaces y recortar fruta de forma imprecisa.                                                                                                                                      | Verificación visual manual en el paso 6 de que cada fruta se ve completa y sin cortes al dibujarse en el canvas; si alguna coordenada se ve mal, ajustar esa entrada puntual del atlas portado (no bloquea el resto).             |

## What is **not** in this spec

- Reutilizar o modificar `asteroides`/`tetris`/`arkanoid`.
- Cualquier otro juego real del catálogo.
- Generalizar un patrón/infraestructura reusable para "juegos con motor real".
- Soporte táctil/móvil.
- Sonido/audio.
- Wrap toroidal en los bordes.
- Obstáculos, power-ups u otras mecánicas de Snake no descritas aquí.
- Tema claro/oscuro.
- Cambios a `references/source-assets/snake-assets/`.

Cada uno de estos, si se implementa, va en su propia spec.
