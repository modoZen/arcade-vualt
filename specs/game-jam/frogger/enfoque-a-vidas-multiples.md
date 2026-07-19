# SPEC GAME-JAM — Frogger — Enfoque A: vidas múltiples con niveles fijos

> **Status:** Draft
> **Depends on:** SPEC 05 (juego real de Asteroides, motor de referencia), SPEC 06 (catálogo y leaderboard reales en Supabase)
> **Date:** 2026-07-18
> **Objective:** Agregar Frogger al catálogo como una entrada `frogger`, con un motor creado desde cero (grid discreta, formas vectoriales) donde la rana tiene 3 vidas y un temporizador por vida, y cruza 5 niveles fijos de carreteras y ríos con dificultad predefinida creciente, hasta ocupar los 5 huecos de meta del nivel 5.

## Scope

**In:**

- Nueva fila `frogger` en la tabla `games` de Supabase, insertada vía `mcp__supabase__apply_migration`.
- Componente `components/games/FroggerGame.tsx` ("use client"): motor completo creado **desde cero** (sin `game.js` de referencia — no existe carpeta para Frogger en `references/started-games/`) dentro de un único `<canvas>` propio de 600×650, con grilla lógica de 12 columnas × 13 filas (50px/celda), escalado por CSS al contenedor `.crt-screen` existente.
- Distribución fija de carriles (de abajo hacia arriba): fila 12 = salida/zona segura (spawn de la rana, centrada horizontalmente); filas 7–11 (5 filas) = carretera con vehículos que cruzan horizontalmente a distinta velocidad y dirección por fila; fila 6 = mediana segura (césped, sin obstáculos); filas 1–5 (5 filas) = río con troncos y tortugas que cruzan horizontalmente (la rana solo sobrevive sobre un tronco o una tortuga a flote); fila 0 = meta, con 5 huecos ("home slots") distribuidos en columnas fijas, cada uno ocupable una sola vez por "ronda" de nivel.
- Movimiento por grilla (hop discreto, no continuo): la rana avanza exactamente una celda por pulsación válida de `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` (con `preventDefault()` para no scrollear la página). Sin WASD — este enfoque es 100% teclado de flechas, a diferencia del Enfoque B.
- El componente acepta las mismas 5 props que el resto de juegos reales: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- **3 vidas** (igual criterio "clásico" que Arkanoid mantiene sus 3 vidas del original, aunque aquí no hay original que copiar): `onLivesChange` reporta `3` al iniciar la partida; decrece en tres casos — (1) la rana es golpeada por un vehículo en la carretera, (2) la rana cae al agua en una fila de río sin estar sobre un tronco/tortuga a flote (incluye tortugas que se sumergen periódicamente), (3) se agota el temporizador de 20 segundos asignado a la vida actual sin llegar a un hueco de meta. Al perder una vida (y quedar `lives > 0`), la rana reaparece en la fila de salida con un temporizador nuevo de 20s; al llegar a `0` se dispara `onGameOver(score)`.
- **Puntaje**: `+10` la primera vez que la rana alcanza una fila más alta que su récord de la vida actual (el récord de "fila más alta alcanzada" se resetea cada vez que la rana reaparece tras perder una vida); `+50` al ocupar un hueco de meta vacío; bono adicional de `segundos_restantes × 10` al ocupar un hueco de meta (recompensa por velocidad, mecánica clásica del arcade original).
- **Niveles fijos 1–5**: cada nivel tiene su propio layout predefinido de velocidad/densidad de vehículos y troncos/tortugas (definido en la implementación, con dificultad estrictamente creciente del nivel 1 al 5). Se avanza de nivel al ocupar los 5 huecos de meta (los 5 huecos vuelven a quedar vacíos y la rana reaparece en la fila de salida con el temporizador reiniciado). `onLevelChange` reporta el nivel activo (1–5).
- Ocupar los 5 huecos de meta del **nivel 5** dispara `onGameOver(score)` exactamente igual que perder la última vida — sin distinción visual entre "victoria" y "derrota" (mismo criterio simple que usó Arkanoid al completar su nivel 5).
- Tortugas que se sumergen periódicamente en algunas filas de río: si la rana está sobre una tortuga en el instante en que se sumerge, cae al agua igual que si no hubiera soporte.
- Todo se dibuja con formas vectoriales de canvas (`fillRect`/`arc`/similar) — vehículos, troncos, tortugas, rana, huecos de meta — sin spritesheet ni asset gráfico externo.
- Nueva ruta `app/juego/frogger/jugar/page.tsx`: reproductor dedicado, clon estructural de `app/juego/asteroides/jugar/page.tsx` (mismo HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales). "GUARDAR PUNTUACIÓN" inserta de verdad en `scores` vía `insertScore`, con `localStorage["av_last_player_name"]`.
- Nueva clase CSS `.cover-frogger` en `app/globals.css`.
- Limpieza de listeners de teclado y del loop (`requestAnimationFrame`/acumulador de tiempo) al desmontar el componente.
- El botón "FIN" termina la partida manualmente en cualquier momento; perder la última vida o completar el nivel 5 también terminan la partida automáticamente — los tres casos abren el mismo modal de fin con el puntaje acumulado.
- **Auto-descubrimiento (heredado de SPEC 06, sin cambios de código):** al existir la fila `frogger` en `games`, el sidebar "MEJORES PUNTUACIONES" de Detalle y ambas vistas de `/salon` (global + nuevo tab "FROGGER") muestran automáticamente el top 10 real filtrado por `game_id: "frogger"`.

**Out of scope (para futuras specs):**

- Reutilizar o modificar `asteroides`/`tetris`/`arkanoid`/`serpiente` — quedan igual, sin tocarse.
- Cualquier otro juego real del catálogo — spec futura si se decide implementar.
- Generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06.
- Soporte de mouse/click o soporte táctil — este enfoque es 100% teclado de flechas (ver Enfoque B para control por clic).
- Sonido/audio.
- Bonus de "vida extra" por puntaje (mecánica clásica del arcade original) — el número de vidas se mantiene fijo en 3 durante toda la partida.
- Dificultad continua/scroll infinito sin niveles fijos — es exactamente la mecánica alternativa que cubre el Enfoque B.
- Tema claro/oscuro.
- RLS, paginación, autenticación real — ya fuera de alcance desde SPEC 06.

## Data model

**1. Nueva fila en `games`** (vía migración Supabase):

```sql
insert into games (id, title, short, long, cat, cover, color)
values (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a una rana con 3 vidas a través de 5 niveles fijos: primero una carretera con tráfico cruzado, luego un río donde solo sobrevive sobre troncos y tortugas. Cada vida tiene 20 segundos para llegar a uno de los 5 huecos de meta antes de que el reloj o el tráfico la atrapen. Completa los 5 huecos del nivel 5 para terminar la partida con el mejor puntaje posible.',
  'ARCADE',
  'cover-frogger',
  'cyan'
);
```

No hay columnas `best`/`plays` — se calculan en consulta (`lib/supabase/games.ts::withStats`), igual que el resto del catálogo.

**2. Props de `FroggerGame`** (`components/games/FroggerGame.tsx`):

```ts
interface FroggerGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- **Mapeo de HUD:**
  - `onScoreChange` → puntaje real del motor: `+10` por cada récord de fila más alta alcanzada en la vida actual, `+50` por hueco de meta ocupado, `+segundos_restantes × 10` como bono de velocidad al llegar a meta.
  - `onLivesChange` → vidas reales del motor. Arranca en `3`; decrece por colisión con vehículo, caída al agua, o temporizador de vida agotado; llega a `0` en el instante del game over.
  - `onLevelChange` → nivel fijo real (1–5), avanza cuando los 5 huecos de meta quedan ocupados.
- Reinicio: sin prop `restart`; la página fuerza remount pasando `key={runId}` distinto, igual que el resto de los juegos reales.
- Los callbacks se disparan solo cuando el valor cambia respecto al último notificado (mismo patrón `notifyState` con diffing que Arkanoid/Tetris/Serpiente). `onGameOver(score)` se dispara una sola vez, con guard, tanto al perder la última vida como al completar el nivel 5.

**3. Estado local de `app/juego/frogger/jugar/page.tsx`** (mismos nombres que el resto de los juegos reales):

```ts
const GAME_ID = "frogger";
const GAME_TITLE = "FROGGER";
const LAST_PLAYER_NAME_KEY = "av_last_player_name"; // misma key global compartida

const [score, setScore] = useState(0);
const [lives, setLives] = useState(3); // Frogger (Enfoque A): 3 vidas, con temporizador por vida
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

## Notas de portado del motor

- **Origen**: no hay `game.js` de referencia para Frogger en `references/started-games/` (verificado: solo existen `02-asteroids`, `03-tetris`, `04-arkanoid`) ni carpeta en `references/source-assets/` — el motor se **crea desde cero**, sin ningún archivo ni asset gráfico a portar.
- **Estilo del motor**: sin precedente directo de OOP; se construye siguiendo el mismo patrón general ya usado por Tetris/Arkanoid/Serpiente (funciones dentro del closure de un único `useEffect([])`, `canvasRef`, `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios, listeners con cleanup, `requestAnimationFrame`).
- **Canvas**: **1** solo `<canvas>` de 600×650, con una grilla lógica de 12 columnas × 13 filas (50px/celda) — resolución no cuadrada, mismo criterio de "elegir el tamaño que mejor sirve a la mecánica" que ya usó Arkanoid (800×600) frente a Serpiente (600×600 cuadrado por su grilla).
- **Loop de movimiento**: la rana se mueve en pasos discretos por celda ante cada pulsación válida de flecha (sin repetición automática por mantener presionada, salvo que el navegador dispare `keydown` repetido — a definir en la implementación si se debounce). Los vehículos/troncos/tortugas, en cambio, se mueven de forma continua por `dt` (con clamp, mismo criterio que Asteroides/Arkanoid) a lo largo de su fila, con velocidad fija por fila y por nivel activo.
- **Assets a portar**: ninguno — todo el motor se dibuja con formas vectoriales de canvas (`fillRect` para vehículos y troncos, `arc`/`fillRect` para tortugas y rana, rectángulos para huecos de meta). No hay carpeta nueva en `public/games/frogger/`.
- **Overlays/reinicio internos a eliminar**: no aplica — al no existir motor original, no hay overlay de "game over" ni reinicio por tecla que remover. El modal de fin y el remount por `key={runId}` son, desde el inicio, la única forma de terminar/reiniciar una partida (mismo criterio final que SPEC 05/07/08/09, pero sin nada previo que limpiar).
- **Controles**: exclusivamente `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, con `preventDefault()` en las 4 para no scrollear la página. Sin WASD y sin mouse/clic — decisión explícita de mantener este enfoque 100% teclado de flechas clásico (contraste directo con el Enfoque B).
- **Condición de derrota (pérdida de vida)**: colisión de la rana con un vehículo en cualquier fila de carretera; la rana ocupa una celda de río sin estar sobre un tronco/tortuga a flote (incluye submersión de tortuga); el temporizador de 20s de la vida actual llega a 0. Cualquiera de las tres decrementa `lives` en 1 y reaparece la rana en la fila de salida (o dispara `onGameOver(score)` si `lives` llega a 0).
- **Condición de avance de nivel**: los 5 huecos de meta quedan todos ocupados simultáneamente → se limpia el estado de huecos, se incrementa `level` (tope en 5) y la rana reaparece en la fila de salida con temporizador nuevo. Completar el nivel 5 dispara `onGameOver(score)` en vez de avanzar a un nivel 6 inexistente.

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): insertar la fila de `frogger` en `games` según el Data model. Verificar con `execute_sql`/`list_tables` que la fila existe y que `asteroides`/`tetris`/`arkanoid`/`serpiente` no cambiaron.
2. Agregar la clase CSS `.cover-frogger` a `app/globals.css`, siguiendo el mismo patrón visual que `.cover-asteroides`/`.cover-tetris`/`.cover-arkanoid`/`.cover-serpiente` (gradiente radial + siluetas vía `::after`/`::before`), como variante propia (paleta cyan, siluetas de carretera/río/rana en vez de rocas/tetraminos/paleta/serpiente).
3. Crear `components/games/FroggerGame.tsx` ("use client"): motor desde cero dentro de un único `useEffect([])` con cleanup. `canvasRef` vía `useRef` apuntando a un `<canvas>` de 600×650 (grilla 12×13, 50px/celda). Estado del motor: posición de la rana `{col, row}`, arrays de vehículos/troncos/tortugas por fila (posición, velocidad, dirección), huecos de meta ocupados/vacíos, vidas, nivel, score, récord de fila más alta de la vida actual, temporizador de vida restante. `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios. Listeners `keydown` para las 4 flechas (con `preventDefault()`), sin WASD ni mouse. Colisión rana-vehículo y rana-agua-sin-soporte decrementan `lives`; temporizador de vida agotado también decrementa `lives`. Ocupar un hueco de meta suma puntos y bono de tiempo; completar los 5 huecos avanza `level` (o dispara `onGameOver` si `level` ya era 5). `onScoreChange`/`onLivesChange`/`onLevelChange` se disparan solo cuando el valor cambia. `paused` congela tanto el movimiento de la rana como de vehículos/troncos/tortugas y el temporizador de vida (se sigue dibujando `draw()`, no se consume el acumulador de tiempo ni el temporizador).
4. Crear `app/juego/frogger/jugar/page.tsx` como ruta estática (sin `params`), clonando la estructura de `app/juego/asteroides/jugar/page.tsx` (HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales, `insertScore`, `localStorage["av_last_player_name"]`), con `lives` inicializado en `3`. Dentro de `.crt-screen`, renderizar `<FroggerGame key={runId} paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setFinalScore(finalScore); setOver(true); }} />`.
5. Verificar: correr el chequeo de tipos (`tsc --noEmit`) y `npm run build` sin errores. Probar manualmente en el navegador: `/juego/frogger` muestra la nueva card con su cover; "JUGAR AHORA" navega a `/juego/frogger/jugar` confirmando que la ruta estática gana precedencia sobre `/juego/[id]/jugar`; las flechas mueven la rana una celda por pulsación sin scrollear la página; la rana muere al chocar con un vehículo, al caer al agua sin soporte, y al agotarse el temporizador de vida; llegar a un hueco de meta vacío lo ocupa y suma puntos + bono de tiempo; ocupar los 5 huecos avanza de nivel y reinicia los huecos; completar el nivel 5 abre el modal de fin igual que perder la última vida; "PAUSA" congela rana, tráfico, río y temporizador; "FIN" abre el modal en cualquier momento; "JUGAR DE NUEVO" reinicia una partida limpia (nivel 1, 3 vidas, puntaje 0, huecos vacíos); "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` y aparece en el sidebar de Detalle y en ambas vistas de `/salon` (global + nuevo tab "FROGGER"); salir/navegar fuera no deja listeners ni `requestAnimationFrame` huérfanos; el resto del catálogo no cambia de comportamiento.

## Acceptance criteria

- [ ] `games` en Supabase contiene una fila con `id: "frogger"` (`title: "FROGGER"`, `cat: "ARCADE"`, `cover: "cover-frogger"`, `color: "cyan"`); las filas de los demás juegos reales no cambiaron.
- [ ] `app/globals.css` define `.cover-frogger` y la card de "frogger" en Biblioteca/Home muestra ese cover (distinto del resto del catálogo).
- [ ] `/juego/frogger` (Detalle) carga sin errores, muestra la info del juego, y el botón "JUGAR AHORA" navega a `/juego/frogger/jugar`.
- [ ] `/juego/frogger/jugar` resuelve la ruta estática dedicada `app/juego/frogger/jugar/page.tsx` (no la genérica `app/juego/[id]/jugar/page.tsx`).
- [ ] En `/juego/frogger/jugar` se ve un `<canvas>` con el juego real corriendo (rana, carretera con vehículos, río con troncos/tortugas, huecos de meta) en vez de divs decorativos.
- [ ] Las 4 flechas mueven la rana una celda a la vez sin scrollear la página; no hay soporte de WASD ni de mouse en este enfoque.
- [ ] Chocar con un vehículo en la carretera resta una vida y reaparece la rana en la fila de salida.
- [ ] Caer al agua sin estar sobre un tronco/tortuga a flote resta una vida; una tortuga que se sumerge con la rana encima también resta una vida.
- [ ] El temporizador de 20s por vida, al llegar a 0 sin haber alcanzado un hueco de meta, resta una vida.
- [ ] Ocupar un hueco de meta vacío suma `+50` puntos más el bono de tiempo restante, y ese hueco queda marcado como ocupado hasta el siguiente nivel.
- [ ] Ocupar los 5 huecos de meta avanza el nivel activo (`onLevelChange`), reinicia los 5 huecos a vacíos, y reaparece la rana en la fila de salida.
- [ ] El HUD superior de React (Puntuación, Vidas, Nivel) se actualiza en tiempo real reflejando el estado real del juego.
- [ ] El canvas no dibuja ningún overlay propio de pausa/game over; esos estados se reflejan solo vía React (overlay de pausa + modal de fin).
- [ ] El botón "PAUSA" congela rana, tráfico, río y el temporizador de vida; "REANUDAR" retoma exactamente donde quedó.
- [ ] El botón "FIN" abre el modal de fin de partida en cualquier momento, con el puntaje acumulado hasta ese instante.
- [ ] Perder la tercera vida abre automáticamente el modal de fin de partida, con el puntaje final correcto.
- [ ] Completar el nivel 5 (ocupar sus 5 huecos de meta) abre automáticamente el mismo modal de fin de partida, con el puntaje final correcto.
- [ ] "GUARDAR PUNTUACIÓN" en el modal inserta una fila real en `scores` (`game_id: "frogger"`, `player_name`, `score`, `user_id: null`), verificable con `execute_sql`; el input "TUS INICIALES" se precarga desde `localStorage["av_last_player_name"]`.
- [ ] "JUGAR DE NUEVO" reinicia una partida completamente nueva (rana en la fila de salida, nivel 1, 3 vidas, puntaje 0, huecos de meta vacíos) y cierra el modal.
- [ ] "SALIR" navega a `/juego/frogger` y detiene el juego (sin errores de consola por listeners/`requestAnimationFrame` huérfanos tras desmontar).
- [ ] Tras guardar el primer puntaje, `frogger` aparece automáticamente en el sidebar "MEJORES PUNTUACIONES" de Detalle y en `/salon` (vista global + nuevo tab "FROGGER"), sin ningún cambio de código en esas pantallas (heredado de SPEC 06).
- [ ] El resto de la plataforma sigue funcionando sin ningún cambio de comportamiento.
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** crear una entrada nueva `frogger` en `games`, separada del resto de juegos reales. Mismo criterio que SPEC 05/07/08/09 (juegos reales aislados entre sí, sin mezclar). Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** `cat: "ARCADE"` — subgénero de "cruzar/esquivar carriles" distinto de los ya existentes en esa categoría (Arkanoid es rebote de pelota, Serpiente es grilla con crecimiento); confirmado libre en `references/game-suggestion-todo.md` y consistente con la tabla `games` real. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** `color: "cyan"` — confirmado contra la tabla `games` real que ningún juego de categoría `ARCADE` usa hoy `cyan` (Arkanoid usa `green`, Serpiente usa `magenta`); `cyan` solo lo usa `asteroides`, de categoría distinta (`SHOOTER`), por lo que no choca dentro del mismo grupo visual del catálogo. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** motor creado **desde cero**, sin `game.js` de referencia — no existe carpeta para Frogger en `references/started-games/` ni asset gráfico en `references/source-assets/`. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** Frogger (Enfoque A) tiene **3 vidas**, con un temporizador de 20s por vida — mecánica clásica del arcade original de 1981 (reloj visible que presiona al jugador). Se prefiere sobre "vida única" para que este enfoque contraste con claridad con el Enfoque B. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** niveles fijos numerados 1–5, cada uno con su propio layout predefinido de velocidad/densidad, en vez de dificultad continua sin fin. Refuerza el carácter "arcade clásico" de este enfoque (curva de dificultad diseñada a mano, con una condición de cierre explícita al completar el nivel 5). Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** completar el nivel 5 dispara `onGameOver(score)` exactamente igual que perder la última vida, sin distinción visual de victoria/derrota — mismo criterio simple que ya usó Arkanoid (SPEC 08) para no agregar una sexta prop o un estado adicional al contrato de HUD. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** controles exclusivamente de flechas (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`), sin WASD ni mouse — contraste directo y deliberado con el esquema dual + clic del Enfoque B. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** canvas de 600×650 con grilla de 12×13 celdas (50px/celda) — tamaño elegido para dar espacio simétrico a 5 filas de carretera + mediana + 5 filas de río + fila de salida + fila de meta, sin forzar un canvas cuadrado que no calza con esa distribución de 13 filas. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** todo el arte es vectorial (canvas shapes), sin spritesheet — evita depender de un asset gráfico que no existe en `references/source-assets/` para este juego, y mantiene el esfuerzo bajo (consistente con la estimación "Bajo" de `references/game-suggestion-todo.md`). Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **No:** bono de "vida extra" por puntaje del arcade original — se mantiene el número de vidas fijo en 3 durante toda la partida, para simplificar el contrato de HUD (`lives` solo baja, nunca sube). Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **No:** soporte táctil/móvil ni sonido/audio — no forman parte del alcance de ningún juego real anterior salvo Arkanoid (que sí tiene audio); se descartan aquí para mantener el esfuerzo bajo. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **No:** generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06. Cada juego real sigue siendo su propio spec puntual.

## Identified risks

| Risk                                                                                                                                                                                                                                                                   | Mitigation                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La precedencia de rutas estáticas sobre dinámicas (`app/juego/frogger/jugar` vs `app/juego/[id]/jugar`) ya se validó en SPEC 05/07/08/09, pero es una verificación por-ruta, no una garantía global de Next.js.                                                        | Confirmar en la práctica al implementar el paso 4 (`/juego/frogger/jugar` resuelve el archivo estático, no el genérico), igual que se hizo en los specs anteriores.                                                                   |
| Sin `game.js` de referencia, no hay una implementación probada de la detección de "rana sobre tronco/tortuga a flote" (debe moverse solidaria a la velocidad del tronco mientras está encima) ni de sincronizar 5 niveles con dificultad estrictamente creciente.      | Verificación manual explícita en el paso 5: confirmar que la rana se desplaza junto con el tronco/tortuga mientras está sobre él, y que la velocidad/densidad de cada nivel es perceptiblemente mayor que la del nivel anterior.      |
| El temporizador de 20s por vida corre en paralelo al loop de `requestAnimationFrame`; si no se pausa correctamente junto con el resto del motor, podría seguir descontando durante la pausa de React y restar una vida "fantasma" justo al reanudar.                   | Igual criterio que el resto de juegos reales: el temporizador se descuenta dentro del mismo `dt` clamped del loop principal, y se salta por completo cuando `pausedRef.current === true` (no se crea un `setInterval` independiente). |
| Definir 5 layouts fijos de dificultad creciente (velocidad/densidad por carril y por nivel) sin una referencia externa que copiar implica diseño de balance "a ojo", con riesgo de que algún nivel resulte injugable (demasiado denso) o trivial (demasiado disperso). | Verificación manual jugando los 5 niveles completos en el paso 5; ajustar los valores de velocidad/densidad puntualmente si algún nivel se siente roto, sin bloquear el resto de la implementación.                                   |

## What is **not** in this spec

- Reutilizar o modificar `asteroides`/`tetris`/`arkanoid`/`serpiente`.
- Cualquier otro juego real del catálogo.
- Generalizar un patrón/infraestructura reusable para "juegos con motor real".
- Soporte de mouse/click o soporte táctil (ver Enfoque B).
- Sonido/audio.
- Bonus de "vida extra" por puntaje.
- Dificultad continua/scroll infinito sin niveles fijos (ver Enfoque B).
- Tema claro/oscuro.
- Cambios a `references/started-games/` o `references/source-assets/` (no aplica, no existe carpeta de referencia para Frogger).

Cada uno de estos, si se implementa, va en su propia spec.
