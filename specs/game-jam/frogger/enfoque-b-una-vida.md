# SPEC GAME-JAM — Frogger — Enfoque B: una vida con dificultad continua e infinita

> **Status:** Draft
> **Depends on:** SPEC 05 (juego real de Asteroides, motor de referencia), SPEC 06 (catálogo y leaderboard reales en Supabase)
> **Date:** 2026-07-18
> **Objective:** Agregar Frogger al catálogo como una entrada `frogger`, con un motor creado desde cero donde la rana tiene una sola vida (muerte súbita al primer choque), controles duales de teclado más clic en el canvas, y una progresión de dificultad continua e infinita (sin niveles fijos ni meta final) — el objetivo es llegar lo más lejos posible antes de perder la única vida.

## Scope

**In:**

- Nueva fila `frogger` en la tabla `games` de Supabase, insertada vía `mcp__supabase__apply_migration`. (Mismo `id`/slug que el Enfoque A — son alternativas mutuamente excluyentes del mismo juego; solo una de las dos migraciones llegará a aplicarse en la práctica, ver Decisions.)
- Componente `components/games/FroggerGame.tsx` ("use client"): motor completo creado **desde cero** dentro de un único `<canvas>` propio de 600×650, con grilla lógica de 12 columnas × 13 filas (50px/celda), escalado por CSS al contenedor `.crt-screen` existente.
- Generación **procedural e infinita** de carriles: en vez de un tablero fijo con meta, las franjas de carriles se generan en un ciclo que se repite sin fin (fila de salida inicial → 5 filas de carretera → 1 mediana segura → 5 filas de río → 1 mediana segura → 5 filas de carretera → ...). Cuando la rana alcanza la fila más alta actualmente generada, se agrega una franja nueva por encima y el viewport/cámara se desplaza hacia arriba; las filas ya cruzadas no vuelven a aparecer.
- Movimiento por grilla (hop discreto): la rana avanza exactamente una celda por acción válida.
- El componente acepta las mismas 5 props que el resto de juegos reales: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- **1 vida** (reinterpretación tipo Tetris/Serpiente, ver SPEC 07/09): `onLivesChange` reporta `1` al iniciar la partida; pasa a `0` en el instante del primer choque con un vehículo o la primera caída al agua sin soporte — sin reaparición, muerte súbita. `onGameOver(score)` se dispara en ese mismo instante.
- **Controles duales**: `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` **y** `W`/`A`/`S`/`D` (equivalentes, mismo criterio que Serpiente en SPEC 09), con `preventDefault()` solo en las 4 flechas. **Además**, clic sobre el canvas: la dirección del hop se calcula comparando la posición del clic contra la posición actual de la rana (eje dominante — si la diferencia horizontal entre el punto clickeado y la rana es mayor que la vertical, hop lateral; si no, hop arriba/abajo según el signo), ejecutando el mismo movimiento que la tecla equivalente. El cálculo exacto de conversión de coordenadas de pantalla a celda de grilla (compensando el escalado CSS del canvas dentro de `.crt-screen`, mismo problema que ya resolvió Arkanoid para su paleta con mouse) se define en la implementación.
- **Progresión de dificultad continua**: no hay niveles fijos ni layouts prediseñados. La velocidad y densidad de vehículos/troncos escalan de forma continua en función de las filas netas cruzadas por la rana (por ejemplo, un multiplicador que crece un porcentaje fijo cada 5 filas cruzadas — la curva exacta se define en la implementación). `onLevelChange` reporta un contador puramente informativo derivado de esa escala continua (`Math.floor(filasNetasCruzadas / 5) + 1`), sin que implique un layout distinto ni ninguna condición de victoria — a diferencia del Enfoque A, "nivel" aquí no es un estado con contenido propio, es solo un indicador de qué tan difícil está el tramo actual.
- **Sin temporizador por vida** (a diferencia del Enfoque A) — no hay reloj individual por intento; la presión sobre el jugador viene exclusivamente de la velocidad creciente del tráfico y el río a medida que avanza, no de una cuenta regresiva externa.
- **Puntaje**: `filas_netas_máximas_alcanzadas × 10`, actualizado en tiempo real cada vez que la rana establece una nueva marca de altura (no se resetea nunca durante la partida, porque solo hay una vida y no hay reaparición). No hay huecos de meta ni bono de tiempo (no aplica, no hay temporizador ni meta fija).
- **Sin condición de victoria**: el juego es infinito hasta el primer choque; no existe un "nivel final" que completar.
- Todo se dibuja con formas vectoriales de canvas (mismo criterio que el Enfoque A) — vehículos, troncos, tortugas, rana — sin spritesheet.
- Nueva ruta `app/juego/frogger/jugar/page.tsx`: reproductor dedicado, clon estructural de `app/juego/asteroides/jugar/page.tsx` (mismo HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales). "GUARDAR PUNTUACIÓN" inserta de verdad en `scores` vía `insertScore`, con `localStorage["av_last_player_name"]`.
- Nueva clase CSS `.cover-frogger` en `app/globals.css` (misma clase que el Enfoque A, ya que ambos comparten el mismo `id`/slug del catálogo; solo uno de los dos enfoques llegará a implementarse).
- Limpieza de listeners de teclado/mouse y del loop (`requestAnimationFrame`/acumulador de tiempo) al desmontar el componente.
- El botón "FIN" termina la partida manualmente en cualquier momento; el primer choque también termina la partida automáticamente — ambos casos abren el mismo modal de fin con el puntaje acumulado.
- **Auto-descubrimiento (heredado de SPEC 06, sin cambios de código):** al existir la fila `frogger` en `games`, el sidebar "MEJORES PUNTUACIONES" de Detalle y ambas vistas de `/salon` (global + nuevo tab "FROGGER") muestran automáticamente el top 10 real filtrado por `game_id: "frogger"`.

**Out of scope (para futuras specs):**

- Reutilizar o modificar `asteroides`/`tetris`/`arkanoid`/`serpiente` — quedan igual, sin tocarse.
- Cualquier otro juego real del catálogo — spec futura si se decide implementar.
- Generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06.
- Niveles fijos con layouts predefinidos y condición de victoria — es exactamente la mecánica alternativa que cubre el Enfoque A.
- Vidas múltiples ni temporizador por vida — ver Enfoque A.
- Sonido/audio.
- Soporte táctil (gestos de swipe) — el control por clic cubre un caso de uso similar sin llegar a implementar gestos táctiles dedicados.
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
  'Guía a una rana con una sola vida a través de un río y una carretera generados sin fin: cada tramo que cruzas es un poco más rápido y denso que el anterior. Muévete con flechas, WASD o un clic en la dirección deseada. No hay reaparición ni meta final — el objetivo es llegar lo más lejos posible antes de que el tráfico o la corriente te atrapen.',
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
  - `onScoreChange` → marca histórica de filas netas cruzadas `× 10`, actualizada en tiempo real cada vez que la rana supera su propio récord de altura de la partida.
  - `onLivesChange` → `1` fijo mientras la rana sigue viva; pasa a `0` en el instante del primer choque con un vehículo o la primera caída al agua sin soporte. Reinterpretación explícita (una sola vida, sin reaparición), mismo criterio que usó Tetris/Serpiente para este stat.
  - `onLevelChange` → contador continuo puramente informativo (`Math.floor(filasNetasCruzadas / 5) + 1`), reflejando qué tan escalada está la dificultad actual — no representa un layout ni un estado de juego distinto, a diferencia del Enfoque A.
- Reinicio: sin prop `restart`; la página fuerza remount pasando `key={runId}` distinto, igual que el resto de los juegos reales.
- Los callbacks se disparan solo cuando el valor cambia respecto al último notificado (mismo patrón `notifyState` con diffing que Arkanoid/Tetris/Serpiente). `onGameOver(score)` se dispara una sola vez, con guard, en el instante del primer choque.

**3. Estado local de `app/juego/frogger/jugar/page.tsx`** (mismos nombres que el resto de los juegos reales):

```ts
const GAME_ID = "frogger";
const GAME_TITLE = "FROGGER";
const LAST_PLAYER_NAME_KEY = "av_last_player_name"; // misma key global compartida

const [score, setScore] = useState(0);
const [lives, setLives] = useState(1); // Frogger (Enfoque B): 1 vida fija, muerte súbita
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
- **Canvas**: **1** solo `<canvas>` de 600×650, con la misma grilla lógica de 12 columnas × 13 filas (50px/celda) que el Enfoque A, pero con **generación procedural infinita**: se mantiene un buffer de franjas de carriles (carretera/mediana/río, en ciclo repetido) que se recicla/desplaza a medida que la rana avanza, en vez de un layout fijo por nivel.
- **Assets a portar**: ninguno — todo el motor se dibuja con formas vectoriales de canvas, igual criterio que el Enfoque A.
- **Overlays/reinicio internos a eliminar**: no aplica — al no existir motor original, no hay overlay de "game over" ni reinicio por tecla que remover. El modal de fin y el remount por `key={runId}` son, desde el inicio, la única forma de terminar/reiniciar una partida.
- **Controles**: `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` **y** `W`/`A`/`S`/`D` (equivalentes), con `preventDefault()` solo en las 4 flechas; **más** un listener de `click` sobre el canvas que traduce la posición del clic (convertida a coordenadas de grilla, compensando el escalado CSS del canvas) en un hop relativo a la posición actual de la rana. El movimiento por clic respeta `pausedRef.current` (no se mueve la rana si `paused === true`), mismo criterio de consistencia que ya aplicó Arkanoid a su paleta controlada por mouse.
- **Condición de derrota (muerte súbita)**: colisión de la rana con un vehículo en cualquier fila de carretera, o la rana ocupa una celda de río sin estar sobre un tronco/tortuga a flote (incluye submersión de tortuga) → `onGameOver(score)` una sola vez, con guard, sin reaparición.
- **Progresión de dificultad**: la velocidad/densidad de vehículos y troncos/tortugas se calcula como una función continua de las filas netas cruzadas (no hay "niveles" con layout propio como en el Enfoque A) — la curva exacta (lineal, por pasos cada 5 filas, u otra) se define en la implementación, siempre estrictamente no decreciente.

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): insertar la fila de `frogger` en `games` según el Data model. Verificar con `execute_sql`/`list_tables` que la fila existe y que `asteroides`/`tetris`/`arkanoid`/`serpiente` no cambiaron.
2. Agregar la clase CSS `.cover-frogger` a `app/globals.css`, siguiendo el mismo patrón visual que `.cover-asteroides`/`.cover-tetris`/`.cover-arkanoid`/`.cover-serpiente` (gradiente radial + siluetas vía `::after`/`::before`), como variante propia (paleta cyan, siluetas de carretera/río/rana).
3. Crear `components/games/FroggerGame.tsx` ("use client"): motor desde cero dentro de un único `useEffect([])` con cleanup. `canvasRef` vía `useRef` apuntando a un `<canvas>` de 600×650 (grilla 12×13, 50px/celda). Estado del motor: posición de la rana `{col, row}`, buffer de franjas de carriles generadas proceduralmente (con reciclaje al desplazar el viewport), vidas (`1`/`0`), score (marca histórica de altura), contador continuo de dificultad. `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios. Listeners `keydown` para flechas + WASD (con `preventDefault()` solo en flechas) y `click` sobre el canvas (con conversión de coordenadas de pantalla a celda de grilla, gateado por `pausedRef.current`). Colisión rana-vehículo o rana-agua-sin-soporte dispara `onGameOver(score)` una sola vez, con guard, sin reaparición. `onScoreChange`/`onLivesChange`/`onLevelChange` se disparan solo cuando el valor cambia. `paused` congela tanto el movimiento de la rana (incluido el control por clic) como el desplazamiento de vehículos/troncos/tortugas y la generación de nuevas franjas.
4. Crear `app/juego/frogger/jugar/page.tsx` como ruta estática (sin `params`), clonando la estructura de `app/juego/asteroides/jugar/page.tsx` (HUD superior, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales, `insertScore`, `localStorage["av_last_player_name"]`), con `lives` inicializado en `1`. Dentro de `.crt-screen`, renderizar `<FroggerGame key={runId} paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setFinalScore(finalScore); setOver(true); }} />`.
5. Verificar: correr el chequeo de tipos (`tsc --noEmit`) y `npm run build` sin errores. Probar manualmente en el navegador: `/juego/frogger` muestra la nueva card con su cover; "JUGAR AHORA" navega a `/juego/frogger/jugar` confirmando que la ruta estática gana precedencia sobre `/juego/[id]/jugar`; flechas y WASD mueven la rana sin scrollear la página; un clic en el canvas mueve la rana en la dirección relativa correcta; la rana muere de inmediato al chocar con un vehículo o caer al agua sin soporte, sin reaparición; el puntaje sube en tiempo real al superar la marca de altura previa; la dificultad (velocidad/densidad de tráfico y río) aumenta de forma perceptible y continua a medida que se cruzan más filas, sin saltos abruptos de "nivel"; nuevas franjas de carriles se generan sin fin a medida que la rana avanza, sin que el juego se quede sin contenido; "PAUSA" congela rana, tráfico, río y la generación de franjas (incluido el control por clic); "FIN" abre el modal en cualquier momento; el primer choque abre automáticamente el mismo modal con el puntaje correcto; "JUGAR DE NUEVO" reinicia una partida limpia (rana en la fila de salida, puntaje 0, dificultad en su valor base); "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` y aparece en el sidebar de Detalle y en ambas vistas de `/salon` (global + nuevo tab "FROGGER"); salir/navegar fuera no deja listeners ni `requestAnimationFrame` huérfanos; el resto del catálogo no cambia de comportamiento.

## Acceptance criteria

- [ ] `games` en Supabase contiene una fila con `id: "frogger"` (`title: "FROGGER"`, `cat: "ARCADE"`, `cover: "cover-frogger"`, `color: "cyan"`); las filas de los demás juegos reales no cambiaron.
- [ ] `app/globals.css` define `.cover-frogger` y la card de "frogger" en Biblioteca/Home muestra ese cover (distinto del resto del catálogo).
- [ ] `/juego/frogger` (Detalle) carga sin errores, muestra la info del juego, y el botón "JUGAR AHORA" navega a `/juego/frogger/jugar`.
- [ ] `/juego/frogger/jugar` resuelve la ruta estática dedicada `app/juego/frogger/jugar/page.tsx` (no la genérica `app/juego/[id]/jugar/page.tsx`).
- [ ] En `/juego/frogger/jugar` se ve un `<canvas>` con el juego real corriendo (rana, carretera, río, franjas generadas sin fin) en vez de divs decorativos.
- [ ] Flechas y WASD mueven la rana sin scrollear la página; un clic sobre el canvas también mueve la rana en la dirección relativa correcta respecto a su posición actual.
- [ ] Chocar con un vehículo, o caer al agua sin estar sobre un tronco/tortuga a flote, termina la partida de inmediato (sin reaparición ni segunda vida).
- [ ] El puntaje (`onScoreChange`) sube en tiempo real cada vez que la rana supera su propia marca de altura previa en la partida, sin resetearse nunca durante la misma.
- [ ] El HUD "Vidas" muestra `1` mientras la rana sigue viva y pasa a `0` en el instante del choque.
- [ ] El nivel/dificultad (`onLevelChange`) aumenta de forma continua conforme la rana cruza más filas, sin layouts fijos ni condición de victoria.
- [ ] El buffer de franjas de carriles se genera sin fin a medida que la rana avanza; el juego nunca se queda sin contenido por delante.
- [ ] El canvas no dibuja ningún overlay propio de pausa/game over; esos estados se reflejan solo vía React (overlay de pausa + modal de fin).
- [ ] El botón "PAUSA" congela rana (incluido el control por clic), tráfico, río y la generación de nuevas franjas; "REANUDAR" retoma exactamente donde quedó.
- [ ] El botón "FIN" abre el modal de fin de partida en cualquier momento, con el puntaje acumulado hasta ese instante.
- [ ] El primer choque (vehículo o agua sin soporte) abre automáticamente el modal de fin de partida, con el puntaje final correcto.
- [ ] "GUARDAR PUNTUACIÓN" en el modal inserta una fila real en `scores` (`game_id: "frogger"`, `player_name`, `score`, `user_id: null`), verificable con `execute_sql`; el input "TUS INICIALES" se precarga desde `localStorage["av_last_player_name"]`.
- [ ] "JUGAR DE NUEVO" reinicia una partida completamente nueva (rana en la fila de salida, puntaje 0, dificultad en su valor base) y cierra el modal.
- [ ] "SALIR" navega a `/juego/frogger` y detiene el juego (sin errores de consola por listeners/`requestAnimationFrame` huérfanos tras desmontar).
- [ ] Tras guardar el primer puntaje, `frogger` aparece automáticamente en el sidebar "MEJORES PUNTUACIONES" de Detalle y en `/salon` (vista global + nuevo tab "FROGGER"), sin ningún cambio de código en esas pantallas (heredado de SPEC 06).
- [ ] El resto de la plataforma sigue funcionando sin ningún cambio de comportamiento.
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** crear una entrada nueva `frogger` en `games`, separada del resto de juegos reales. Mismo criterio que SPEC 05/07/08/09. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** usar el mismo `id`/slug `frogger` que el Enfoque A — son alternativas mutuamente excluyentes del mismo juego; solo una de las dos migraciones/specs llegará a promoverse a un spec numerado real. No se genera un slug distinto por enfoque porque, una vez elegido uno, el otro se descarta por completo. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** `cat: "ARCADE"` y `color: "cyan"`, mismos valores que el Enfoque A (confirmados libres contra la tabla `games` real) — ambos enfoques comparten la misma ficha de catálogo porque son variantes del mismo juego, no juegos distintos. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** motor creado **desde cero**, sin `game.js` de referencia — no existe carpeta para Frogger en `references/started-games/` ni asset gráfico en `references/source-assets/`. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** Frogger (Enfoque B) tiene **1 sola vida**, con muerte súbita en el primer choque — reinterpretación del stat "vidas" igual que hicieron Tetris y Serpiente (SPEC 07/09) para juegos sin sistema de vidas múltiples propio, elegida aquí a propósito para maximizar el contraste mecánico frente al Enfoque A. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** controles duales de teclado (flechas + WASD, mismo criterio que Serpiente) **más** control por clic sobre el canvas — el primer juego real del catálogo en combinar tres formas de input simultáneas. El clic se gatea por `pausedRef.current` con el mismo criterio de consistencia que ya usó Arkanoid para su paleta con mouse. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** progresión de dificultad continua e infinita (sin niveles fijos, sin condición de victoria, con generación procedural de franjas de carriles), en contraste directo y deliberado con los 5 niveles fijos del Enfoque A. `onLevelChange` se reinterpreta como un contador puramente informativo derivado de la escala continua, no como un estado de juego con contenido propio. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** sin temporizador por vida — a diferencia del Enfoque A, la presión del juego viene solo de la velocidad creciente del tráfico/río, no de un reloj individual por intento (que no tendría sentido con una sola vida y muerte súbita). Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** puntaje = marca histórica de filas netas cruzadas `× 10`, sin huecos de meta ni bono de tiempo — coherente con la ausencia de meta fija y de temporizador en este enfoque. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **Sí:** canvas de 600×650 con grilla de 12×13 celdas (50px/celda), mismo tamaño base que el Enfoque A, para que el buffer procedural pueda reutilizar el mismo cálculo de layout por franja (carretera/mediana/río) sin redefinir proporciones. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **No:** niveles fijos con layout predefinido ni condición de victoria — es exactamente la mecánica que cubre el Enfoque A; incluirla aquí eliminaría el contraste entre ambos specs. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **No:** soporte táctil dedicado (gestos de swipe) ni sonido/audio — se mantiene fuera de alcance para conservar el esfuerzo bajo, igual que el Enfoque A. Decisión de game-jam (sin confirmar con el usuario — revisar en la revisión).
- **No:** generalizar infraestructura reusable para "juegos con motor real" más allá de lo ya generalizado por SPEC 05/06. Cada juego real sigue siendo su propio spec puntual.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                           | Mitigation                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La precedencia de rutas estáticas sobre dinámicas (`app/juego/frogger/jugar` vs `app/juego/[id]/jugar`) ya se validó en SPEC 05/07/08/09, pero es una verificación por-ruta, no una garantía global de Next.js.                                                                                | Confirmar en la práctica al implementar el paso 4 (`/juego/frogger/jugar` resuelve el archivo estático, no el genérico), igual que se hizo en los specs anteriores.                                                                      |
| El canvas se escala por CSS dentro de `.crt-screen`; convertir la posición del clic (`e.clientX`/`e.clientY`) a una celda de grilla interna (12×13) requiere compensar ese escalado, o el clic no apuntará a la celda correcta bajo el cursor.                                                 | Portar el mismo criterio de `scaleX`/`scaleY` que ya usó Arkanoid para su paleta con mouse (`canvas.width / rect.width`), aplicado sobre `canvasRef.current.getBoundingClientRect()`, antes de mapear el clic a fila/columna.            |
| Interpretar la dirección de un clic como "un solo hop en el eje dominante" puede sentirse poco intuitivo si el jugador clickea muy lejos de la rana esperando varios saltos de una vez, o si clickea en una posición ambigua (diagonal casi exacta entre eje horizontal y vertical).           | Verificación manual explícita en el paso 5: probar clics en distintas posiciones relativas a la rana y confirmar que el hop resultante es predecible; documentar en la implementación el criterio exacto de desempate diagonal.          |
| La generación procedural infinita de franjas (buffer que crece y se recicla) es un patrón sin precedente en el proyecto — un bug en el reciclaje del buffer podría dejar huecos sin carriles generados, o acumular franjas viejas sin liberarlas y degradar el rendimiento en partidas largas. | Verificación manual explícita en el paso 5 jugando varios minutos seguidos, confirmando que nunca aparece una fila vacía por delante de la rana y que el número de franjas activas en memoria se mantiene acotado (no crece sin límite). |
| Sin temporizador por vida, una partida podría quedar "estancada" si el jugador simplemente no avanza (se queda quieto en una fila segura) — a diferencia del Enfoque A, donde el reloj fuerza el avance.                                                                                       | Aceptado como comportamiento válido de este enfoque: quedarse quieto en una fila segura es una estrategia legítima (evita morir, pero tampoco suma puntaje); no se agrega un mecanismo de presión adicional fuera de alcance.            |

## What is **not** in this spec

- Reutilizar o modificar `asteroides`/`tetris`/`arkanoid`/`serpiente`.
- Cualquier otro juego real del catálogo.
- Generalizar un patrón/infraestructura reusable para "juegos con motor real".
- Niveles fijos con layout predefinido y condición de victoria (ver Enfoque A).
- Vidas múltiples ni temporizador por vida (ver Enfoque A).
- Sonido/audio.
- Soporte táctil dedicado (gestos de swipe).
- Tema claro/oscuro.
- Cambios a `references/started-games/` o `references/source-assets/` (no aplica, no existe carpeta de referencia para Frogger).

Cada uno de estos, si se implementa, va en su propia spec.
