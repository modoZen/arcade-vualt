# SPEC NN — Juego real de <Título>

> **Status:** Draft
> **Depends on:** SPEC 05 (juego real de Asteroides, motor de referencia), SPEC 06 (catálogo y leaderboard reales en Supabase)
> **Date:** <fecha>
> **Objective:** <una sola frase: agregar <Título> como juego real jugable con leaderboard, portado desde <referencia o "desde cero">>

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (`id: "<slug>"`, `title`, `short`, `long`, `cat`, `cover: "cover-<slug>"`, `color`), insertada vía `mcp__supabase__apply_migration`.
- Clase CSS `.cover-<slug>` en `app/globals.css`, siguiendo el molde de `.cover-asteroides`/`.cover-rocas` (gradiente radial + `::after` con figuras + `::before` con glifo), variante propia.
- Componente `components/games/<Nombre>Game.tsx` ("use client"): encapsula el motor completo <portado desde `references/started-games/<carpeta>/game.js` | creado desde cero> dentro de un `<canvas>` propio.
- El componente acepta como props: `paused` y los callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` (mismo contrato que `AsteroidsGame`).
- Nueva ruta `app/juego/<slug>/jugar/page.tsx`: reproductor dedicado, clon estructural de `app/juego/asteroides/jugar/page.tsx` (HUD, PAUSA/FIN/SALIR, modal de fin, guardado real de puntuación vía `insertScore`).
- Limpieza de listeners de teclado y `requestAnimationFrame` al desmontar.
- "GUARDAR PUNTUACIÓN" inserta de verdad en `scores` (reutiliza `lib/supabase/scores.ts::insertScore`); el nombre se recuerda en `localStorage["av_last_player_name"]`.

**Out of scope (para futuras specs):**

- Cualquier otro juego real del catálogo distinto de <Título>.
- Generalizar infraestructura reusable para "juegos con motor real" más allá de lo que ya generalizó SPEC 05/06.
- Soporte táctil/móvil.
- Sonido/audio (salvo que la referencia ya lo tenga y se decida explícitamente incluirlo).
- RLS, paginación, autenticación real — ya fuera de alcance desde SPEC 06.
- Modificar `references/started-games/<carpeta>/` (si aplica; queda intacta como referencia).

## Data model

**1. Nueva fila en `games`** (vía migración Supabase):

```sql
insert into games (id, title, short, long, cat, cover, color)
values ('<slug>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>');
```

No hay columnas `best`/`plays` — se calculan en consulta (`lib/supabase/games.ts`), igual que el resto del catálogo.

**2. Props de `<Nombre>Game`** (`components/games/<Nombre>Game.tsx`):

```ts
interface <Nombre>GameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- **Mapeo de HUD** (a definir por juego, no todos tienen "vidas" en sentido literal): `onScoreChange` → <qué representa>; `onLivesChange` → <qué representa, o "constante fija si el juego no tiene vidas">; `onLevelChange` → <qué representa>.
- Reinicio: sin prop `restart`; la página fuerza remount con `key={runId}`, igual que Asteroides.
- Los callbacks se disparan solo cuando el valor cambia, no en cada frame.

**3. Estado local de `app/juego/<slug>/jugar/page.tsx`** (mismo patrón que `asteroides/jugar/page.tsx`):

```ts
const [score, setScore] = useState(0);
const [lives, setLives] = useState(<valor inicial>);
const [level, setLevel] = useState(1);
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [runId, setRunId] = useState(0);
const [name, setName] = useState(/* localStorage["av_last_player_name"] ?? user ?? "INVITADO" */);
const [saved, setSaved] = useState(false);
const [saving, setSaving] = useState(false);
```

## Notas de portado del motor (rellenar según la referencia)

- **Origen**: `references/started-games/<carpeta>/game.js` | motor nuevo desde cero.
- **Estilo del motor**: OOP (clases, como Asteroids) | procedural (funciones globales, como Tetris/Arkanoid).
- **Canvas**: cuántos `<canvas>` usa el original (Asteroids/Arkanoid: 1; Tetris: 2 — tablero + "siguiente pieza").
- **Assets/archivos extra**: ¿hay `style.css`, `levels.js`, `assets/*.js` (spritesheets) que también hay que portar o inlinear?
- **Overlays/reinicio internos a eliminar**: el original puede dibujar su propio "GAME OVER" en canvas y/o reiniciar con una tecla — se elimina, lo reemplaza el modal de React (mismo criterio que SPEC 05).
- **Controles**: qué teclas usa y cuáles requieren `preventDefault()` para no scrollear la página (típicamente flechas y espacio).

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): insertar la fila de `<slug>` en `games` según el Data model. Verificar con `execute_sql`/`list_tables`.
2. Agregar la clase CSS `.cover-<slug>` a `app/globals.css`, siguiendo el patrón visual de `.cover-asteroides`.
3. Crear `components/games/<Nombre>Game.tsx` ("use client"): portar el motor completo (ver Notas de portado) al cuerpo del componente, con `canvasRef` vía `useRef`. Listeners de teclado y `requestAnimationFrame` en un único `useEffect([])` con cleanup. `pausedRef`/`callbacksRef` sincronizados por `useEffect` secundarios para que el loop lea props frescas sin remontar el motor. `paused` se lee al inicio del loop: si es `true`, se salta `update(dt)` pero se sigue llamando `draw()`. Callbacks disparados solo cuando el valor cambia; `onGameOver` una sola vez.
4. Crear `app/juego/<slug>/jugar/page.tsx` como ruta estática, clonando la estructura de `app/juego/asteroides/jugar/page.tsx` (HUD, botones, modal, `insertScore`, `localStorage["av_last_player_name"]`).
5. Verificar: `tsc --noEmit` y `npm run build` sin errores. Probar manualmente: `/juego/<slug>` muestra la card con su cover; "JUGAR AHORA" resuelve la ruta estática (no la genérica `[id]/jugar`); controles responden sin scrollear la página; HUD de React sincronizado con el HUD interno del canvas; PAUSA/FIN/game-over automático abren el modal correcto; "JUGAR DE NUEVO" reinicia limpio; "GUARDAR PUNTUACIÓN" inserta en `scores` y aparece en el sidebar de Detalle y en `/salon` (ambas vistas); el resto del catálogo no cambia de comportamiento.

## Acceptance criteria

- [ ] `games` en Supabase contiene una fila con `id: "<slug>"` (verificable con `execute_sql`).
- [ ] `app/globals.css` define `.cover-<slug>` y la card correspondiente lo muestra.
- [ ] `/juego/<slug>` (Detalle) carga sin errores; "JUGAR AHORA" navega a `/juego/<slug>/jugar`.
- [ ] `/juego/<slug>/jugar` resuelve la ruta estática dedicada, no la genérica `[id]/jugar`.
- [ ] El `<canvas>` muestra el juego real corriendo, con el motor portado/creado funcionando.
- [ ] Los controles responden sin scrollear la página.
- [ ] El HUD superior de React se sincroniza con el estado real del juego (mapeo de HUD documentado arriba).
- [ ] El canvas no dibuja su propio overlay de "game over"; ese estado vive solo en el modal de React.
- [ ] PAUSA congela la simulación; REANUDAR continúa exactamente donde quedó.
- [ ] FIN y la condición de derrota interna abren el mismo modal con el puntaje correcto.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (verificable con `execute_sql`), y el nombre se recuerda en `localStorage`.
- [ ] "JUGAR DE NUEVO" reinicia una partida completamente nueva del motor real.
- [ ] "SALIR" navega al Detalle y detiene el juego sin listeners/`requestAnimationFrame` huérfanos.
- [ ] El resto del catálogo sigue funcionando sin cambios de comportamiento.
- [ ] `tsc --noEmit` no reporta errores.
- [ ] `npm run build` termina sin errores.

## Decisions

<a completar en Fase 3 del skill junto con el usuario — ej. por qué se eligió cierto mapeo de HUD, qué se descartó del motor original, etc.>

## Identified risks

| Risk                                                                                                                              | Mitigation                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Precedencia de rutas estáticas sobre dinámicas (`app/juego/<slug>/jugar` vs `app/juego/[id]/jugar`) asumida igual que en SPEC 05. | Confirmar en `node_modules/next/dist/docs/01-app/` antes de implementar el paso 4, igual que hizo SPEC 05.      |
| Teclas de control (flechas/espacio) pueden scrollear la página si falta `preventDefault()`.                                       | Aplicar `e.preventDefault()` en el listener de `keydown` para las teclas de control, igual que `AsteroidsGame`. |
| <riesgo específico del motor portado, si el original es multi-archivo o usa un estilo distinto (procedural vs OOP)>               | <mitigación>                                                                                                    |

## What is **not** in this spec

- Cualquier otro juego real del catálogo.
- Generalizar infraestructura reusable para "juegos con motor real".
- Soporte táctil/móvil.
- RLS, paginación, autenticación real.

Cada uno de estos, si se implementa, va en su propia spec.
