---
name: nuevo-juego
description: Genera un spec para agregar un juego real con su leaderboard a Arcade Vault (motor en canvas portado a React + fila en `games` de Supabase + ruta dedicada + cover CSS), combinando los patrones de SPEC 05 y SPEC 06. Úsalo cuando el usuario quiera incorporar un juego jugable nuevo al catálogo, venga o no de `references/started-games/`. No escribe código; produce el spec y para.
argument-hint: "<slug-o-nombre-del-juego> [carpeta-de-referencia opcional]"
---

# /nuevo-juego — Spec designer para juegos reales con leaderboard

Este skill es un `/spec` especializado. Su único trabajo es producir un spec listo para `/spec-impl` que describa cómo agregar un **juego real jugable con leaderboard** al catálogo de Arcade Vault. **No escribe código, no aplica migraciones, no toca `app/globals.css` ni ningún `.tsx`.** Solo genera el archivo `.md` en `specs/` y se detiene.

## Philosophy

Arcade Vault ya resolvió este problema una vez: SPEC 05 portó el motor de Asteroids (`references/started-games/02-asteroids/game.js`) a un componente React con `<canvas>`, y SPEC 06 lo conectó a un catálogo y leaderboard reales en Supabase. Juntas dejaron un **contrato repetible** de cinco piezas (ver "El contrato" abajo). Este skill existe para no tener que re-derivar ese contrato cada vez que se agrega un juego — pero cada motor de juego es distinto (OOP vs procedural, cuántas vidas tiene, cuántos canvas usa), así que **igual hay que preguntar** antes de escribir el spec.

Lee `template.md` (en el mismo directorio que este skill) — es la plantilla exacta que rellenarás sección por sección.

## El contrato "juego real con leaderboard"

Todo spec que este skill produzca debe cubrir estas cinco piezas, tal como se hizo con Asteroides:

1. **Fila en la tabla `games` de Supabase** (`id` slug, `title`, `short`, `long`, `cat` ∈ ARCADE/PUZZLE/SHOOTER/VERSUS, `cover` = nombre de clase CSS, `color` ∈ cyan/magenta/yellow/green), insertada vía `mcp__supabase__apply_migration` durante la implementación. Sin columnas `best`/`plays` — se calculan en consulta.
2. **Clase CSS `.cover-<slug>`** en `app/globals.css`, siguiendo el molde de `.cover-asteroides`/`.cover-rocas` (gradiente radial + `::after` con figuras + `::before` con glifo de nave/personaje).
3. **Componente `components/games/<Nombre>Game.tsx`** ("use client", default export) con el contrato de 5 props ya usado por `AsteroidsGame`:
   ```ts
   interface <Nombre>GameProps {
     paused: boolean;
     onScoreChange: (score: number) => void;
     onLivesChange: (lives: number) => void;
     onLevelChange: (level: number) => void;
     onGameOver: (finalScore: number) => void;
   }
   ```
   Patrón de implementación (igual que `components/games/AsteroidsGame.tsx`): motor completo dentro de un único `useEffect([])`; `canvasRef` vía `useRef`; `pausedRef`/`callbacksRef` como espejos mutables sincronizados por `useEffect` secundarios (así el loop lee props frescas sin remontar el motor); listeners `keydown`/`keyup` en `window` con `preventDefault()` en las teclas de control; `requestAnimationFrame` con `cancelAnimationFrame` en cleanup; si `paused` es `true` se salta `update(dt)` pero se sigue llamando `draw()`; callbacks disparados solo cuando el valor cambia; `onGameOver` una sola vez. Se elimina cualquier overlay de "game over" y reinicio-por-tecla interno del motor original — eso lo reemplaza el modal de React.
4. **Ruta dedicada `app/juego/<slug>/jugar/page.tsx`** — clon estructural de `app/juego/asteroides/jugar/page.tsx`: mismo HUD, botones PAUSA/FIN/SALIR, overlay de pausa, modal de fin, `<Componente key={runId} .../>` para reinicio por remount, y `saveScore()` que llama a `insertScore` (de `lib/supabase/scores.ts`) + guarda `av_last_player_name` en `localStorage`. Esta ruta estática sombrea a `app/juego/[id]/jugar/page.tsx` por precedencia de Next.js — el botón "JUGAR AHORA" del Detalle (`/juego/${id}/jugar`) no necesita tocarse.
5. **Auto-descubrimiento**: Home, Biblioteca, Detalle (`app/juego/[id]/page.tsx`) y Salón leen el catálogo con `getGames`/`getGameById` (`lib/supabase/games.ts`) — no se tocan si la fila existe en `games`.

**Helpers existentes a reutilizar, nunca recrear** — cítalos por nombre en el spec: `lib/supabase/games.ts` (`getGames`, `getGameById`), `lib/supabase/scores.ts` (`insertScore`, `getTopScoresByGame`, `getTopScoresGlobal`), `lib/supabase/types.ts` (`Game`, `ScoreRow`, `CATS`), `lib/supabase/client.ts` / `server.ts`.

**Matices que varían por juego y NO se pueden asumir:**

- No todo juego tiene "vidas" en sentido literal (Tetris no; Arkanoid sí). El mapeo de `score`/`lives`/`level` del motor real a los 3 callbacks de HUD debe quedar explícito en el spec, incluso si algún stat es una constante fija o se reinterpreta.
- Las referencias en `references/started-games/` no son uniformes: Asteroids usa clases (OOP); Tetris y Arkanoid son procedurales (funciones globales). Tetris usa 2 `<canvas>` + `style.css` separado; Arkanoid usa `levels.js` + `assets/spritesheet.js` (multi-archivo). Si el juego viene de una referencia, el spec debe registrar su estilo (OOP/procedural), cuántos canvas usa y qué archivos extra hay que portar o inlinear.
- Si el juego no viene de ninguna referencia, el spec describe el motor a crear desde cero, con el mismo contrato de props.

## Command flow

Sigue las cuatro fases en orden. Tus respuestas deben ir en el mismo idioma del prompt inicial del usuario.

### Phase 1 — Contexto

1. Leer `CLAUDE.md`/`AGENTS.md` si no los tienes ya en contexto.
2. Listar `specs/` para determinar el próximo número secuencial y leer `specs/05-juego-asteroides.md` y `specs/06-catalogo-y-leaderboard-supabase.md` — son la referencia canónica del patrón que este skill replica.
3. Si el `$ARGUMENTS` incluye o sugiere una carpeta bajo `references/started-games/`, listar sus archivos y leer su `game.js` (y `index.html`) para clasificar el motor: ¿OOP (clases) o procedural (funciones globales)? ¿cuántos `<canvas>` usa? ¿tiene `style.css`, `levels.js`, `assets/*` u otros archivos que también haya que portar? Si no hay referencia identificable, anota "motor desde cero" y sigue.
4. Si `$ARGUMENTS` viene vacío, pide un nombre o slug del juego antes de continuar.

### Phase 2 — Preguntas

Pregunta en bloques de 3 a 5, esperando respuesta antes de seguir. Cubre siempre:

- **Metadata de catálogo**: `title`, `short`, `long`, `cat` (ARCADE/PUZZLE/SHOOTER/VERSUS), `color` (cyan/magenta/yellow/green), y confirma el slug (`id`) y el nombre de clase `cover-<slug>`.
- **Mapeo de HUD**: qué representa `onScoreChange`; qué va en "vidas" (`onLivesChange`) — si el juego no tiene vidas, pregunta explícitamente qué mostrar ahí o si se oculta ese stat; qué va en "nivel" (`onLevelChange`).
- **Controles**: qué teclas usa el juego y cuáles necesitan `preventDefault()` para no scrollear la página (normalmente flechas y espacio, pero confirma según el motor real).
- **Limpieza del motor original** (si hay referencia): qué overlays internos (game over, pausa) y qué reinicio-por-tecla se eliminan, siguiendo el mismo criterio de SPEC 05 (el modal de React los reemplaza).
- **Assets/archivos extra** (si el motor es multi-archivo): confirmar qué se porta o inlinea (p. ej. `style.css`, `levels.js`, spritesheets).
- Recuerda que la migración de Supabase se aplicará vía `mcp__supabase__apply_migration` durante `/spec-impl`, no ahora.

Si el usuario propone algo fuera de este contrato (p. ej. multijugador local, sonido complejo, controles táctiles), señala que es candidato a spec propia y pregunta si se deja fuera de alcance.

**No sigas preguntando más allá de lo necesario para responder:** ¿qué archivos van a aparecer o cambiar?, ¿cuál es el primer paso ejecutable y cuál el último?, ¿cómo se verifica que el juego quedó funcionando?

### Phase 3 — Desarrollar el spec sección por sección

No generes el spec completo de una sola vez. Usa `template.md` como esqueleto y complétalo sección por sección, mostrando cada una y esperando confirmación antes de seguir:

1. **Header** (Status `Draft`, `Depends on: SPEC 05, SPEC 06`, Date, objetivo en una frase).
2. **Scope** (In / Out explícito — usa el molde de `template.md`, ajustado a este juego).
3. **Data model** (fila de `games`, props del componente con el mapeo de HUD ya confirmado, estado local de la página).
4. **Notas de portado del motor** (origen, estilo OOP/procedural, canvas, assets extra, overlays/reinicio a eliminar, controles) — omite esta sección solo si el juego se crea desde cero y no hay nada que portar.
5. **Implementation plan** (numerado: migración MCP → CSS cover → componente → ruta dedicada → verificación).
6. **Acceptance criteria** (checklist booleano, no aspiracional).
7. **Decisions** (con justificación breve — especialmente el mapeo de HUD y qué se descartó del motor original).
8. **Identified risks** (precedencia de ruta estática, `preventDefault`, y cualquier riesgo propio del motor portado).

Después de cada sección: muéstrala en markdown y pregunta "¿Esta sección queda así o quieres ajustar algo?". Solo avanza cuando el usuario confirma.

### Phase 4 — Guardar y parar

1. Determinar el próximo número secuencial mirando `specs/`.
2. Proponer el nombre de archivo `specs/NN-juego-<slug>.md` y confirmarlo con el usuario antes de escribir.
3. Crear el archivo con todas las secciones aprobadas, Status `Draft`.
4. Confirmar al usuario:
   - Ruta del archivo creado.
   - Recordatorio: el spec está en `Draft`; cámbialo a `Approved` tras releerlo.
   - Próximo paso: `/spec-impl NN-juego-<slug>`.
   - **Detente aquí.** No propongas implementar el spec, escribir código, ni aplicar la migración.

## Hard rules

- **Nunca escribas código, CSS ni SQL de verdad durante este skill.** Solo el archivo `.md` del spec al final (el SQL de ejemplo dentro del spec es documentación, no se ejecuta).
- **Nunca apliques la migración de Supabase durante este skill** — eso es trabajo de `/spec-impl`, no de este generador.
- **Nunca asumas metadata, mapeo de HUD, ni estilo de motor sin confirmar con el usuario.**
- **Nunca generes el spec completo en una sola respuesta** — sección por sección, con confirmación.
- **El mapeo de HUD siempre debe quedar explícito por escrito** en el spec, incluso cuando parezca obvio (p. ej. "sin vidas, se oculta ese stat" es una decisión válida, pero debe estar escrita).
- Si el juego propuesto no calza con el patrón canvas + score/HUD + leaderboard (p. ej. es por turnos, multijugador en tiempo real, o no tiene noción de "puntaje"), dilo explícitamente y pregunta si de todas formas se fuerza el contrato o si el alcance debe replantearse antes de escribir el spec.

## Arguments

Si se invocó `/nuevo-juego tetris references/started-games/03-tetris`, usa `tetris` como sugerencia de slug y esa ruta como referencia a explorar en Phase 1 — confirma ambos con el usuario antes de avanzar. Si solo viene el nombre del juego sin referencia, trátalo como "motor desde cero" salvo que el usuario aclare lo contrario. Si `$ARGUMENTS` viene vacío, pide el nombre o slug del juego para empezar.
