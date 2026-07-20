# SPEC 12 — Optimización de rendimiento del render de Frogger

> **Status:** Borrador
> **Depends on:** `specs/game-jam/frogger/01-frogger-core.md` (Frogger core) — optimiza el motor `components/games/FroggerGame.tsx` que ese spec implementó, sin cambiar su comportamiento ni su apariencia
> **Date:** 2026-07-20
> **Objective:** Reducir el costo por frame del `draw()` de `FroggerGame.tsx` sin alterar una sola diferencia visual, atacando tres hotspots concretos: (1) pre-renderizar el fondo estático en un canvas offscreen invalidado solo al cambiar `goals`/skin en vez de redibujar 14 `fillRect` por frame, (2) saltear por completo la manipulación de `shadowBlur`/`shadowColor` en `drawEntity` cuando el skin no tiene `glow`, y (3) cachear `roundTimeForLevel(level)` en una variable recalculada por ronda en vez de invocarla en cada `drawHud`.

## Scope

**In:**

- **Fondo estático cacheado en canvas offscreen** en `FroggerGame.tsx`:
  - Crear un `OffscreenCanvas` (o un `<canvas>` en memoria vía `document.createElement("canvas")` como fallback) del mismo tamaño `CANVAS_W × CANVAS_H`, sobre el que se pre-renderizan las 14 franjas de fondo por zona (`bgGoal`/`bgRiver`/`bgRoad`/`bgGrass`) **y** las 5 bocas destino (`drawGoals`), que hoy se redibujan con `fillRect`/`strokeRect` en cada frame.
  - El loop principal reemplaza esos ~14 `fillRect` + el dibujo del terreno de las bocas por un único `ctx.drawImage(bgCanvas, 0, 0)` por frame.
  - **Invalidación explícita**: el offscreen se re-renderiza solo cuando cambia algo que lo afecta — el skin activo (`skinRef.current`) o el estado `goals` (una boca se llena, o se resetean al completar ronda / iniciar). Se lleva un "cache key" (skin actual + snapshot de `goals`) y se compara al inicio de cada frame; si difiere, se regenera el offscreen una vez.
- **Shadows condicionados a `glow`** en `drawEntity` (y donde aplique en `drawFrog`/`drawGoals`): si `def.glow` es falso (skins `retro`/`pastel`/`pixel`), **no se ejecuta ninguna** asignación de `shadowColor`/`shadowBlur` ni el reset a 0 — se saltea el bloque entero. Solo el skin `neon` (`glow: true`) mantiene el efecto, con el mismo resultado visual que hoy.
- **`roundTimeForLevel(level)` cacheado**: guardar el valor en una variable del closure (p. ej. `roundTimeMs`) que se recalcula únicamente cuando cambia `level` (en `completeRound()` y en la inicialización), en vez de invocar la función en cada `drawHud()`. `drawHud` y `roundTimeForLevel` de `update`/reset leen esa variable.
- **Verificación de paridad visual y de rendimiento** con Chrome DevTools Performance (grabar antes/después y comparar el tiempo de main thread del `draw()`) + capturas de Playwright confirmando que el render es visualmente idéntico en los 4 skins.

**Out of scope (para futuras specs):**

- Cualquier cambio de **comportamiento** del juego: mecánicas, colisiones, puntuación, temporizador, saltos, wrap de carriles, ciclo de tortugas — intactos.
- Cualquier cambio **visual**: el resultado dibujado debe ser pixel-idéntico al actual en los 4 skins; no se retocan colores, formas, glow ni layout.
- Las **5 props** del componente (`paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) y el prop `skin` — sin cambios en la firma.
- La lógica de `update()` salvo el cacheo puntual de `roundTimeMs` (que es un cambio de rendimiento, no de comportamiento).
- Optimizar el `moveLanes`/física por frame (recorrido de entidades) — no es un hotspot de render identificado; queda fuera.
- Extender estas optimizaciones a los otros juegos (Asteroides, Tetris, Arkanoid, Serpiente). Este spec deja el **patrón documentado** para que luego se arme un agente de rendimiento reusable, pero no toca esos componentes.
- La play-page `app/juego/frogger/jugar/page.tsx`, el HUD React, Supabase, o `app/globals.css` — sin cambios.

## Data model

Este spec **no introduce datos nuevos** en Supabase, ni props, ni tipos exportados. Los únicos elementos nuevos son estructuras internas del closure de `FroggerGame.tsx`, todas de rendimiento:

- **`bgCanvas: HTMLCanvasElement`** (o `OffscreenCanvas` si está disponible) — buffer offscreen de `CANVAS_W × CANVAS_H` donde se pre-renderiza el fondo por zonas + las 5 bocas. Se crea una vez al montar; su contenido se regenera solo al invalidarse.
- **`bgCtx: CanvasRenderingContext2D`** — contexto 2D del buffer, obtenido una vez.
- **`bgCacheKey: string | null`** — clave que representa el estado visual del fondo actualmente pintado en `bgCanvas`. Se compone del skin activo y del estado de las bocas, p. ej. `` `${skinRef.current}|${goals.map(g => g ? 1 : 0).join("")}` ``. Al inicio de `draw()` se calcula la clave esperada; si difiere de `bgCacheKey`, se llama a `renderBackground()` y se actualiza la clave.
- **`renderBackground()`** — función nueva que pinta las 14 franjas de zona + `drawGoals` (recuadro, borde y elipse de "boca llena") sobre `bgCtx` (misma lógica que hoy vive en `draw()` y `drawGoals`, movida al buffer). Es la única que dibuja el terreno estático.
- **`roundTimeMs: number`** — valor cacheado de `roundTimeForLevel(level)`. Se recalcula solo en la inicialización y en `completeRound()` (cuando cambia `level`). Reemplaza las llamadas directas a `roundTimeForLevel(level)` en `drawHud` y en los resets de `timeLeft`.

No cambian: `Lane`, `Entity`, `Frog`, `SkinDef`, `SKINS`, `FroggerSkin`, ni la interfaz `FroggerGameProps`.

## Implementation plan

Cada paso deja el componente compilando y jugable; se verifica en el navegador antes de avanzar.

1. **Cachear `roundTimeForLevel` en `roundTimeMs`** (el cambio más aislado):
   - Declarar `let roundTimeMs = roundTimeForLevel(level);` junto al resto del estado del closure.
   - Recalcularlo en `completeRound()` (después de `level += 1`) y en cualquier punto donde `level` cambie.
   - Reemplazar las llamadas a `roundTimeForLevel(level)` en `drawHud` (el `ratio`) y en los resets de `timeLeft` (`resetFrogPosition`, init) por `roundTimeMs`.
   - Verificación: la barra de tiempo del HUD se comporta idéntico; el temporizador sigue acortándose por nivel.

2. **Condicionar los shadows a `def.glow`**:
   - En `drawEntity`, envolver toda asignación de `shadowColor`/`shadowBlur` (y sus resets a 0) en `if (def.glow) { ... }`, de modo que con `glow` falso no se toque el estado de sombra del contexto en absoluto.
   - Hacer lo mismo donde `drawFrog` y `drawGoals` manipulan sombras.
   - Confirmar que el reset final `ctx.shadowBlur = 0` solo se ejecuta si hubo glow (o dejar un único reset defensivo por frame si algún path lo necesita).
   - Verificación: los skins `retro`/`pastel`/`pixel` se ven exactamente igual; `neon` conserva su glow.

3. **Extraer `renderBackground()` y crear el buffer offscreen**:
   - Crear `bgCanvas`/`bgCtx` una sola vez al inicio del `useEffect` (con fallback a `createElement("canvas")` si `OffscreenCanvas` no existe).
   - Mover la lógica de las 14 franjas de zona (el `for (row...)` de `draw()`) + la de `drawGoals` (recuadro, borde y elipse de boca llena) a `renderBackground()`, que dibuja sobre `bgCtx`.
   - Verificación aislada: llamar `renderBackground()` una vez y `ctx.drawImage(bgCanvas,0,0)` en `draw()` en lugar del fondo inline; el terreno se ve idéntico.

4. **Invalidación por `bgCacheKey`**:
   - Al inicio de `draw()`, computar la clave esperada (`skin + snapshot de goals`); si difiere de `bgCacheKey`, llamar `renderBackground()` y actualizar la clave.
   - El resto de `draw()` queda: `drawImage(bg)` → entidades (carriles) → rana → HUD.
   - Verificación: al llenar una boca o cambiar de skin desde el HUD, el fondo se actualiza en el frame correcto; el resto del tiempo no se regenera (confirmable con un `console.count` temporal en `renderBackground`, removido antes de cerrar).

5. **Verificación de rendimiento y paridad visual**:
   - Chrome DevTools → Performance: grabar ~10 s de juego antes (rama base, `main`) y después (rama del spec), comparar el tiempo agregado de main thread atribuible a `draw()` / scripting por frame. Esperado: menos tiempo por frame, sobre todo en skins sin glow.
   - Playwright en los 4 skins (`retro`/`neon`/`pastel`/`pixel`): capturar el canvas en un mismo estado de juego y confirmar que es visualmente idéntico a la versión previa. Guardar en `.playwright-screenshots/`.
   - `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `roundTimeForLevel(level)` ya **no** se invoca dentro de `drawHud`; el HUD lee la variable cacheada `roundTimeMs`, que solo se recalcula al cambiar de nivel.
- [ ] La barra de tiempo del HUD y la muerte por tiempo se comportan idéntico a antes (mismo tiempo inicial por nivel, mismo acortamiento por nivel).
- [ ] En los skins `retro`, `pastel` y `pixel` (`glow: false`), `drawEntity`/`drawFrog`/`drawGoals` **no** ejecutan ninguna asignación de `shadowColor`/`shadowBlur`.
- [ ] En el skin `neon` (`glow: true`), el glow de entidades, rana y bocas se ve exactamente igual que antes del spec.
- [ ] El fondo por zonas + las 5 bocas (recuadro, borde y elipse de boca llena) se pre-renderizan en un canvas offscreen; el loop principal los pinta con un único `drawImage` por frame en vez de ~14 `fillRect` + el dibujo inline de las bocas.
- [ ] El offscreen se regenera **solo** cuando cambia el skin activo o el estado de `goals` (verificable: un `console.count` temporal en `renderBackground` no incrementa frame a frame durante el juego normal).
- [ ] Al llenar una boca, al completar una ronda (reset de bocas) y al cambiar de skin desde el HUD, el fondo cacheado se actualiza correctamente en pantalla.
- [ ] El render final es visualmente idéntico al de la versión previa en los 4 skins (comparación de capturas Playwright en un mismo estado de juego).
- [ ] DevTools Performance muestra un tiempo de scripting/`draw()` por frame menor que en `main` para el mismo tramo de juego (medición antes/después documentada).
- [ ] Ninguna de las 5 props ni el prop `skin` cambian de firma; el comportamiento del juego (colisiones, puntuación, saltos, wrap de carriles, ciclo de tortugas) es indistinguible del actual.
- [ ] Los listeners y el `requestAnimationFrame` se siguen limpiando en el `return` del `useEffect` (sin fugas por el nuevo buffer).
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí: canvas offscreen para el fondo estático** (opción elegida sobre "optimizar solo `drawGoals`" o "mover el fondo a CSS"). Un `drawImage` reemplaza ~14 `fillRect` + el dibujo del terreno de las 5 bocas por frame, y el buffer se invalida pocas veces (llenar boca, cambiar skin, reset de ronda). Decisión explícita del usuario.
- **Sí: meter la elipse de "boca llena" en el buffer**, no dibujarla dinámica por frame. Depende solo de `goals`/skin, cambia una vez por boca llenada; incluirla en el offscreen (con `goals` en el `bgCacheKey`) mantiene todo el terreno estático en un solo lugar. Decisión explícita del usuario.
- **Sí: saltear por completo `shadowColor`/`shadowBlur` cuando `def.glow` es falso**, no solo bajarlo a 0. Reasignar el estado de sombra del contexto tiene costo aunque el blur sea 0; 3 de los 4 skins no usan glow, así que se evita ese trabajo en la mayoría de las partidas. Decisión explícita del usuario.
- **Sí: cachear `roundTimeForLevel(level)` en `roundTimeMs`**, recalculado solo al cambiar `level`. Es una función pura de `level`, que cambia una vez por ronda y no por frame. Decisión explícita del usuario.
- **Sí: `OffscreenCanvas` con fallback a `<canvas>` en memoria.** No todos los navegadores garantizan `OffscreenCanvas` para 2D; el fallback vía `document.createElement("canvas")` da el mismo resultado sin arriesgar compatibilidad.
- **Sí: ordenar la implementación de menor a mayor riesgo** (cache de tiempo → shadows condicionales → offscreen), un commit verificable por paso. Facilita aislar cualquier regresión visual.
- **Sí: medir antes/después con Chrome DevTools Performance** (main thread de `draw()`), comparando la rama del spec contra `main`, más capturas Playwright de paridad visual. Elegido sobre un contador de FPS en pantalla; el proyecto no tiene tests automatizados.
- **No: optimizar `moveLanes`/la física por frame.** El recorrido de entidades no es un hotspot de render identificado; tocarlo arriesga cambiar comportamiento sin ganancia medida. Fuera de alcance.
- **No: extender el patrón a los otros 4 juegos en este spec.** Se documenta el patrón (fondo offscreen, shadows condicionales, cachear cálculos puros por-frame) para que después se arme un agente de rendimiento reusable; aplicarlo a Asteroides/Tetris/Arkanoid/Serpiente es trabajo aparte.
- **No: tocar props, apariencia, play-page, HUD React, Supabase o `globals.css`.** El spec es una optimización interna del render, sin efecto observable salvo mejor rendimiento.

## Identified risks

| Risk                                                                                                                                                                                              | Mitigation                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El `bgCacheKey` no captura alguna condición que sí cambia el fondo (p. ej. un reset de `goals` al completar ronda), dejando el buffer desactualizado en pantalla ("boca fantasma" llena o vacía). | El key incluye el snapshot completo de `goals` (`g ? 1 : 0` por boca) + el skin; se verifica explícitamente el caso de llenar boca, completar ronda y cambiar de skin en el paso 4–5. |
| Al mover los shadows dentro de `if (def.glow)`, olvidar un reset `shadowBlur = 0` y dejar el estado de sombra "contaminado" entre paths dentro del skin `neon`, alterando su apariencia.          | Revisar que en el path `glow` cada bloque resetee como hoy; comparación de capturas del skin `neon` antes/después en el paso 5.                                                       |
| `OffscreenCanvas` no disponible o con contexto 2D limitado en algún navegador, rompiendo el pre-render.                                                                                           | Fallback a `document.createElement("canvas")`; el mismo `drawImage` funciona con ambos. Verificar en el navegador objetivo.                                                           |
| El nuevo buffer offscreen no se libera al desmontar y queda retenido junto con el closure del `useEffect`.                                                                                        | El buffer vive dentro del scope del `useEffect`; al desmontarse se descarta con el closure. Confirmar en el criterio de limpieza (sin listeners/RAF colgados).                        |
| Regenerar el offscreen justo en el frame en que se llena una boca añade un pico puntual de trabajo (14 `fillRect` + bocas en ese frame).                                                          | Es un evento raro (una vez por boca/ronda/skin), no por frame; el costo amortizado sigue siendo mucho menor que redibujar el fondo 60 veces por segundo. Aceptado.                    |
| La mejora medida sea marginal en máquinas potentes, haciendo difícil "demostrar" la ganancia en la clase.                                                                                         | Medir en DevTools con CPU throttling (4×/6×) para amplificar la diferencia; los skins sin glow y el `drawImage` único muestran la reducción de forma más clara bajo throttling.       |
