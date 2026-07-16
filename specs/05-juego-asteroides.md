# SPEC 05 — Juego real de Asteroides

> **Status:** Aprobado
> **Depends on:** SPEC 01 (rutas base, `GAMES`, pantalla Detalle `/juego/[id]`, patrón visual del Reproductor — HUD, modal de fin de partida, CRT)
> **Date:** 2026-07-15
> **Objective:** Agregar el juego real de Asteroids (adaptado desde `references/started-games/02-asteroids/game.js`) como una nueva entrada `asteroides` en el catálogo, con su propio Reproductor en la ruta estática `/juego/asteroides/jugar` (que Next.js resuelve por precedencia sobre `/juego/[id]/jugar`), sincronizando el motor del juego con el HUD y los controles (pausa/fin/reinicio) existentes.

## Scope

**In:**

- Nueva entrada `asteroides` en `GAMES` (`app/data/games.ts`), independiente de `rocas` (que no se toca).
- Componente `components/games/AsteroidsGame.tsx` ("use client"): encapsula el motor completo adaptado de `game.js` (clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, loop `update`/`draw`, input de teclado, wrap toroidal, colisiones, power-up de disparo triple) dentro de un `<canvas>` propio (800×600, escalado por CSS al contenedor `.crt-screen` existente, que ya es 4:3).
- El componente acepta como props: `paused` (controlado desde React, congela el loop real cuando es `true`) y los callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` — el juego notifica por ahí cada cambio de estado interno hacia React.
- Se elimina el overlay interno de "GAME OVER" del canvas (`drawOverlay` en `game.js` cuando `state === 'gameover'`) — el modal de fin de partida de React lo reemplaza por completo. El HUD interno del canvas (score/nivel/vidas, `drawHUD`) sí se conserva (doble HUD ya acordado).
- Se elimina también el reinicio interno por tecla `Espacio` en estado `gameover` (`initGame()` disparado desde dentro de `game.js`) — el reinicio pasa a estar controlado exclusivamente por React ("JUGAR DE NUEVO" en el modal), para que el motor nunca reinicie sin que React se entere.
- Nueva ruta `app/juego/asteroides/jugar/page.tsx`: Reproductor dedicado para este juego, con el mismo HUD superior, botones (PAUSA/FIN/SALIR) y modal de fin de partida que ya existen en el Reproductor genérico, pero alimentados por el estado real que reporta `AsteroidsGame` en lugar del `setInterval` decorativo.
- Dentro del `.crt-screen` de esta página, el `<canvas>` del juego reemplaza al `.game-arena` decorativo (grid-floor, enemies, player-ship falsos).
- Limpieza de listeners de teclado y `requestAnimationFrame` al desmontar el componente (salir con "SALIR" o navegar fuera).
- El botón "FIN" termina la partida manualmente en cualquier momento; llegar a 0 vidas dentro del juego también termina la partida automáticamente (ambos casos abren el mismo modal de fin con el puntaje acumulado, vía `onGameOver`).
- "JUGAR DE NUEVO" en el modal reinicia el motor del juego por completo (nueva partida desde cero), no solo el estado de React.

**Out of scope (para futuras specs):**

- Reutilizar `rocas` o modificarlo — queda igual, decorativo.
- Cualquier otro juego real del catálogo (Bloque Buster, Caída, Serpentina, etc.) — cada uno es su propia spec futura si se decide implementar.
- Generalizar un patrón/infraestructura reusable para "juegos con motor real" (rutas dedicadas, tipos de props compartidos) — se resuelve puntualmente para `asteroides`; si aparece un segundo juego real, ese spec decide si generaliza.
- Persistencia de la puntuación (guardar en Supabase/localStorage) — "GUARDAR PUNTUACIÓN" en el modal sigue siendo solo cambio de estado local (`saved: true`), igual que el resto de la plataforma (decisión ya tomada en SPEC 01).
- Soporte táctil/móvil para los controles del juego.
- Cambiar el tag "TECLADO / TÁCTIL" en la pantalla de Detalle.
- Sonido/audio (el original tampoco lo tiene).
- Modificar `references/started-games/02-asteroids/` (queda como referencia intacta).

## Data model

Este spec no introduce persistencia nueva (sin tablas, sin `localStorage`), pero sí define tres estructuras concretas:

**1. Nueva entrada en `GAMES`** (`app/data/games.ts`) — mismo tipo `Game` ya existente, sin cambios de forma:

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Pulveriza rocas espaciales en gravedad cero.",
  long: "Nave en un campo de asteroides toroidal. Destruye rocas para sumar puntos: las grandes se parten en medianas, las medianas en pequeñas. Sobrevive con 3 vidas e invencibilidad temporal al reaparecer.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

- Requiere una clase nueva `.cover-asteroides` en `app/globals.css` (variante propia, no reutiliza `.cover-rocas`).
- `best`/`plays` arrancan en `0` (no hay partidas reales todavía); son cosméticos, igual que en el resto del catálogo — no se recalculan dinámicamente en este spec.

**2. Props de `AsteroidsGame`** (`components/games/AsteroidsGame.tsx`):

```ts
interface AsteroidsGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- `paused`: cuando es `true`, el componente deja de invocar `update(dt)` en cada frame (sigue llamando `draw()` para no dejar el canvas congelado a mitad de un frame roto, pero la simulación no avanza). El control de pausa vive en React, el componente solo lo respeta.
- Reinicio ("JUGAR DE NUEVO"): no hay prop `restart`. La página fuerza un remount completo pasando una `key` distinta al componente (ej. `<AsteroidsGame key={runId} .../>`), lo que reinicia el motor desde cero de forma idiomática en React, sin exponer una API imperativa adicional.
- Los callbacks se disparan solo cuando el valor realmente cambia (no en cada frame), para evitar renders de React innecesarios en cada `update(dt)`.

**3. Estado local de `app/juego/asteroides/jugar/page.tsx`** (reemplaza el `setInterval` decorativo del Reproductor genérico):

```ts
const [score, setScore] = useState(0);
const [lives, setLives] = useState(3);
const [level, setLevel] = useState(1);
const [paused, setPaused] = useState(false);
const [over, setOver] = useState(false);
const [finalScore, setFinalScore] = useState(0);
const [runId, setRunId] = useState(0); // cambia para forzar remount/reinicio del motor
const [name, setName] = useState(user ?? "INVITADO");
const [saved, setSaved] = useState(false);
```

`onGameOver(finalScore)` y el botón "FIN" hacen lo mismo: `setFinalScore(finalScore); setOver(true)`.

## Implementation plan

1. Agregar la nueva entrada `asteroides` a `GAMES` en `app/data/games.ts` (ver Data model), sin tocar la entrada `rocas` ni el resto del catálogo.
2. Agregar la clase CSS `.cover-asteroides` a `app/globals.css`, siguiendo el mismo patrón visual que `.cover-rocas` (gradiente + siluetas), pero como variante propia e independiente.
3. Crear `components/games/AsteroidsGame.tsx` ("use client"): portar el motor completo de `references/started-games/02-asteroids/game.js` (constantes, utils `wrap`/`dist`/`rand`/`randInt`, clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, `spawnAsteroids`, `initGame`, `nextLevel`, `explode`, `killShip`, `update`, `draw`, `drawHUD`, `drawLifeIcon`) al cuerpo del componente, referenciando un `<canvas>` propio vía `useRef` en vez de `getElementById`. Los listeners de teclado (`keydown`/`keyup`) y el `requestAnimationFrame` se registran y limpian dentro de un único `useEffect` con cleanup, con `e.preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` para evitar scroll de página. Se elimina `drawOverlay` para `state === 'gameover'` y el `pressed('Space') → initGame()` interno en ese mismo estado. El `paused` prop se lee al inicio del loop: si es `true`, se salta la llamada a `update(dt)` de ese frame (pero se sigue llamando `draw()`). Los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange` se disparan solo cuando el valor cambia respecto al último notificado; `onGameOver(score)` se dispara una vez, en el instante en que `killShip()` deja `lives <= 0`.
4. Crear `app/juego/asteroides/jugar/page.tsx` como ruta estática (sin `params`), reutilizando la estructura visual del Reproductor genérico (`app/juego/[id]/jugar/page.tsx`: HUD superior, botones PAUSA/FIN/SALIR, `.crt`/`.crt-screen`/`.crt-bottom`, modal de fin de partida con input de iniciales). Dentro de `.crt-screen`, renderizar `<AsteroidsGame key={runId} paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setFinalScore(finalScore); setOver(true); }} />` en vez de los divs decorativos `.game-arena`. "PAUSA" alterna `paused`; "FIN" ejecuta directamente `setFinalScore(score); setOver(true)`; "SALIR" navega a `/juego/asteroides`; "JUGAR DE NUEVO" resetea todo el estado local (`score`, `lives`, `level`, `over`, `saved`, `paused`) e incrementa `runId` para forzar el remount del motor.
5. Verificar: revisar `node_modules/next/dist/docs/01-app/` para confirmar la precedencia de rutas estáticas sobre dinámicas en Next `16.2.10` antes de dar el paso 4 por sentado. Correr el chequeo de tipos (`tsc`) y `npm run build` sin errores. Probar manualmente en el navegador: `/juego/asteroides` muestra la nueva card con su cover; "JUGAR AHORA" navega a `/juego/asteroides/jugar` (confirmando que la ruta estática gana precedencia sobre `/juego/[id]/jugar`); el juego responde a flechas/espacio sin scrollear la página, el HUD superior de React se mantiene sincronizado con el HUD interno del canvas; "PAUSA" congela la nave/asteroides; "FIN" y llegar a 0 vidas abren el mismo modal con el puntaje correcto; "JUGAR DE NUEVO" reinicia una partida limpia; salir/navegar fuera no deja listeners de teclado ni `requestAnimationFrame` corriendo en segundo plano (sin errores en consola); `/juego/rocas` y el resto del catálogo siguen mostrando la simulación decorativa sin cambios.

## Acceptance criteria

- [ ] `GAMES` en `app/data/games.ts` contiene una entrada con `id: "asteroides"` (`title: "ASTEROIDES"`, `cat: "SHOOTER"`, `cover: "cover-asteroides"`); la entrada `rocas` no cambió.
- [ ] `app/globals.css` define `.cover-asteroides` y la card de "asteroides" en Biblioteca/Home muestra ese cover (distinto del de `rocas`).
- [ ] `/juego/asteroides` (Detalle) carga sin errores, muestra la info del juego, y el botón "JUGAR AHORA" navega a `/juego/asteroides/jugar`.
- [ ] `/juego/asteroides/jugar` resuelve la ruta estática `app/juego/asteroides/jugar/page.tsx` (no la genérica `app/juego/[id]/jugar/page.tsx`).
- [ ] En `/juego/asteroides/jugar` se ve un `<canvas>` con el juego real corriendo (nave, asteroides, wrap toroidal) en vez de los divs decorativos `.game-arena`.
- [ ] Las flechas (`←`/`→`/`↑`) rotan/propulsan la nave y `Espacio` dispara, incluyendo el disparo triple al recoger el power-up `3x`.
- [ ] El HUD superior de React (Puntuación, Vidas, Nivel) se actualiza en tiempo real reflejando el estado real del juego (no un `setInterval` aleatorio).
- [ ] El HUD interno del canvas (`SCORE`, `NIVEL`, iconos de vidas, indicador `3x`) se sigue dibujando dentro del canvas, sin duplicar el overlay de game over.
- [ ] El canvas ya no dibuja su propio overlay de "GAME OVER"; ese estado se refleja solo en el modal de React.
- [ ] Presionar `Espacio` estando en el estado interno de gameover del motor **no** reinicia el juego por sí solo (el reinicio depende exclusivamente de "JUGAR DE NUEVO").
- [ ] El botón "PAUSA" congela el movimiento de nave/asteroides/balas (no siguen avanzando detrás del overlay "EN PAUSA"); "REANUDAR" retoma exactamente donde quedó.
- [ ] El botón "FIN" abre el modal de fin de partida en cualquier momento, con el puntaje acumulado hasta ese instante.
- [ ] Perder la tercera vida dentro del juego abre automáticamente el mismo modal de fin de partida, con el puntaje final correcto, sin necesidad de tocar "FIN".
- [ ] Guardar la puntuación en el modal muestra el toast "PUNTUACIÓN GUARDADA" (sin persistir en `localStorage`, igual que el resto de la plataforma).
- [ ] "JUGAR DE NUEVO" reinicia una partida completamente nueva del motor real (nave centrada, 3 vidas, nivel 1, puntaje 0, asteroides reposicionados) y cierra el modal.
- [ ] "SALIR" navega a `/juego/asteroides` y detiene el juego (sin errores de consola por listeners/`requestAnimationFrame` huérfanos tras desmontar).
- [ ] `/juego/rocas` y el resto del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen mostrando la simulación decorativa sin ningún cambio de comportamiento.
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** crear una entrada nueva `asteroides` en `GAMES`, separada de `rocas`. `rocas` es contenido decorativo preexistente del catálogo; mezclar el motor real ahí generaría confusión entre el placeholder original y el juego funcional.
- **No:** reutilizar o modificar `rocas`. Decisión explícita del usuario para mantener ambos aislados.
- **Sí:** ruta estática dedicada `app/juego/asteroides/jugar/page.tsx` en vez de ramificar por `id` dentro de `app/juego/[id]/jugar/page.tsx`. Mantiene el Reproductor genérico (usado por 8 juegos decorativos) sin condicionales especiales, y aprovecha que Next.js resuelve segmentos estáticos con precedencia sobre segmentos dinámicos del mismo nivel — el link "JUGAR AHORA" en Detalle sigue siendo genérico (`/juego/${game.id}/jugar`), sin lógica condicional.
- **No:** generalizar un patrón/infraestructura reusable para "juegos con motor real". Se resuelve puntualmente para `asteroides`; si aparece un segundo juego real, esa spec decide si vale la pena abstraer.
- **Sí:** el motor del juego vive encapsulado en un componente específico (`AsteroidsGame.tsx`), dueño de su propio `<canvas>`, no una API/framework genérico para "juegos" en general. Es lo que pidió explícitamente el usuario.
- **Sí:** comunicación motor → React exclusivamente por props/callbacks (`paused` de entrada; `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` de salida). Evita estado compartido implícito o globals fuera de React, y es el patrón idiomático para integrar un loop imperativo dentro de un componente controlado.
- **Sí:** doble HUD — el canvas conserva su propio `drawHUD` (score/nivel/vidas/`3x`) y React sigue mostrando su HUD superior, sincronizados vía callbacks. Decisión explícita del usuario en la Fase 2.
- **Sí:** se elimina el overlay interno de "GAME OVER" (`drawOverlay`) del canvas; lo reemplaza el modal de React. Decisión explícita del usuario — evita dos mensajes de "fin de partida" superpuestos.
- **Sí:** se elimina también el reinicio interno por `Espacio` en estado `gameover` de `game.js`. Si se dejara, el motor podría reiniciarse sin que React se entere (React seguiría mostrando el modal de un run que el canvas ya abandonó).
- **Sí:** el reinicio de partida se hace remontando `AsteroidsGame` con una `key` distinta (`runId`) en vez de exponer una API imperativa (`ref.restart()`). Es el patrón idiomático de React para "empezar de cero" un componente con estado interno complejo, y evita tener que replicar `initGame()` como método expuesto.
- **Sí:** `paused` es una prop controlada por React (el "contenedor"), no un estado interno que el canvas decida solo. Decisión explícita del usuario: "es la aplicación, el contenedor, quien va a controlar la pausa". Cuando `paused === true`, el componente deja de llamar `update(dt)` pero sigue llamando `draw()`.
- **Sí:** el botón "FIN" sigue terminando la partida manualmente en cualquier momento (comportamiento heredado de SPEC 01), y coexiste con el game over automático por 0 vidas — ambos casos convergen en el mismo modal.
- **No:** persistir la puntuación (Supabase o `localStorage`). "GUARDAR PUNTUACIÓN" sigue siendo solo un cambio de estado local (`saved: true`), consistente con la decisión ya tomada en SPEC 01; conectar persistencia real es una spec futura (post SPEC 04, que ya dejó los clientes de Supabase listos pero sin tablas).
- **No:** soporte táctil/móvil para los controles. El juego original es solo teclado; agregar controles on-screen es trabajo adicional fuera de este spec. El tag "TECLADO / TÁCTIL" en Detalle queda como está (decorativo, heredado del template), sin corregirse aquí.
- **Sí:** `best: 0` y `plays: "0"` como valores iniciales de la nueva entrada en `GAMES`. No hay partidas reales registradas todavía (sin persistencia), así que cualquier otro número sería inventado.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                  | Mitigation                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La precedencia de rutas estáticas sobre dinámicas (`app/juego/asteroides/jugar` vs `app/juego/[id]/jugar`) es un supuesto de enrutamiento de Next.js; Next `16.2.10` no es la versión de entrenamiento (aclarado en `AGENTS.md`) y podría tener cambios de convención.                | Antes de implementar el paso 4, revisar `node_modules/next/dist/docs/01-app/` (rutas dinámicas / colisión de rutas) para confirmar que la precedencia estática-sobre-dinámica sigue vigente en esta versión antes de asumirla. |
| Las flechas y `Espacio` son teclas que el navegador usa para hacer scroll de la página; el `game.js` original no llama `preventDefault()` porque era una página standalone sin scroll. Dentro de la plataforma (con Nav/footer), esto podría scrollear la pantalla mientras se juega. | En `AsteroidsGame.tsx`, llamar `e.preventDefault()` en el listener de `keydown` para `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` mientras el componente está montado.                                                           |
| El canvas tiene una resolución interna fija (800×600) escalada por CSS al tamaño de `.crt-screen`; en pantallas de alta densidad (retina) o tamaños muy grandes puede verse borroso o pixelado.                                                                                       | Se acepta como trade-off de este spec (mismo comportamiento que el juego original); ajustar `devicePixelRatio`/resolución dinámica queda para una spec futura si se reporta como problema visual real.                         |

## What is **not** in this spec

- Reutilizar o modificar `rocas`.
- Cualquier otro juego real del catálogo (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel).
- Generalizar un patrón/infraestructura reusable para "juegos con motor real".
- Persistencia de la puntuación (Supabase o `localStorage`).
- Soporte táctil/móvil.
- Cambios al tag "TECLADO / TÁCTIL" de Detalle.
- Sonido/audio.
- Cambios a `references/started-games/02-asteroids/`.

Cada uno de estos, si se implementa, va en su propia spec.
