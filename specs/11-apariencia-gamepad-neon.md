# SPEC 11 — Apariencia de gamepad neón para los controles táctiles

> **Status:** Draft
> **Depends on:** SPEC 10 (controles táctiles) — reviste el `TouchControls` que ese spec creó
> **Date:** 2026-07-19
> **Objective:** Reemplazar la apariencia plana de `TouchControls` por el look del gamepad neón de `references/gamepad-assets/` (chasis con glow, D-pad en cruz con flechas SVG + hub con gema pulsante, botones circulares A/B), sin alterar su comportamiento (eventos de teclado sintéticos, `directionMode`, props) ni la garantía de caber sin scroll en portrait.

## Scope

**In:**

- Restyle visual de `components/games/TouchControls.tsx` (solo markup de presentación) para calcar `references/gamepad-assets/gamepad.html`:
  - **Chasis** (`.touch-controls` pasa a ser el panel tipo `.gp`): gradiente `#1c1c28→#0c0c14`, `border-radius`, borde interno cyan vía `::before`, textura de puntos vía `::after`, sombra con glow cyan. Layout interno en grid de 2 columnas (D-pad izquierda / acciones derecha).
  - **D-pad en cruz**: los 4 botones dejan de ser un grid 3×3 con glifos de texto y pasan a botones absolutos en cruz (`.dp-up/.dp-down/.dp-left/.dp-right`) con **flechas SVG** (los mismos paths triangulares de la referencia), relieve 3D (`box-shadow` inferior), y estado presionado con glow cyan (`:active` + hundimiento `translateY`).
  - **Hub central** decorativo (`.dp-hub` + `.dp-hub-gem`): rombo cyan con `clip-path` y animación `pulse-led` infinita.
  - **Botones de acción circulares A/B** (`.touch-action-btn` pasa a `.ab`): círculo con gradiente radial, borde `currentColor`, letra en `--pixel` (A/B), anillo punteado (`.ab-ring`) visible en hover/active, relieve 3D y glow. Primer botón → **A magenta** (primario), segundo → **B cyan**.
- Estados `hover` (para dispositivos híbridos con mouse) y `:active`/presionado en D-pad y A/B, calcados de la referencia.
- Ajuste del breakpoint `@media (max-width: 480px)` en `app/globals.css` para el nuevo chasis/botones, preservando que todo quepa sin scroll en portrait (equivalente al `@media (max-width: 620px)` de la referencia, recalibrado al layout de la app).
- Reutilización de los tokens de color existentes del proyecto (`--cyan`, `--magenta`, `--pixel`, `--line`, `--bg`, `--bg-2`) en vez de hardcodear los hex de la referencia.

**Out of scope (para futuras specs):**

- Cualquier cambio de comportamiento: los eventos sintéticos, `directionMode` (`hold`/`repeat`/`tap`), la lógica de auto-repeat, y las props `directionMode`/`actions` **no cambian**.
- Sincronizar el estado visual "presionado" con **teclas físicas** (resaltar el D-pad cuando se usa el teclado real). La referencia lo hace vía JS; acá el feedback visual es solo `:hover`/`:active` sobre los propios botones táctiles. (Se puede agregar en otra spec.)
- Los 4 componentes motores (`AsteroidsGame`/`TetrisGame`/`ArkanoidGame`/`SerpienteGame`) y sus 5 props — intactos.
- El overlay `.landscape-lock` y su lógica — sin cambios.
- Cambios a las 4 páginas `app/juego/<slug>/jugar/page.tsx` (siguen instanciando `<TouchControls>` con las mismas props). El mapeo por juego (qué acción, qué modo) no cambia.
- Sonido/vibración háptica, temas claro/oscuro, datos/Supabase.

## Data model

No hay cambios de datos ni cambios en las props de `TouchControls`: siguen siendo `directionMode: "hold" | "repeat" | "tap"` y `actions?: { code: string; label: string }[]`. Lo único que se introduce son estructuras de **presentación**:

- **Letra del botón de acción**: derivada de la posición en `actions` (índice 0 → `"A"` magenta, índice 1 → `"B"` cyan). El `label` de cada acción deja de renderizarse como texto visible y pasa a `aria-label`. No se agrega ningún campo nuevo a `TouchActionConfig`.
- **Clases CSS nuevas/renombradas** en `app/globals.css` (sección `/* ===== touch controls ===== */`), calcando la referencia: el chasis (`.touch-controls` + `::before`/`::after`), `.touch-dpad` (contenedor en cruz), `.touch-dpad-btn` con modificadores `.up/.down/.left/.right`, `.touch-dpad-arrow` (SVG), `.touch-hub` + `.touch-hub-gem` (con `@keyframes pulse-led`), `.touch-actions`, y `.touch-action-btn` con modificadores `.a`/`.b` y `.touch-action-ring`.
- **SVG inline** de las flechas: los 4 paths triangulares de la referencia (up/right/down/left), embebidos en el markup del componente.

## Implementation plan

1. **Markup de `TouchControls.tsx`** — reescribir solo la parte de presentación (sin tocar `press`/`release`/`dispatchKey`/`useIsTouchDevice`):
   - `DirButton`: reemplazar el texto `label` por un `<svg className="touch-dpad-arrow">` con el path triangular según la dirección; conservar `aria-label`, los handlers de puntero y `touchAction: "none"`. El D-pad pasa de grid 3×3 a los 4 botones absolutos en cruz.
   - Agregar el nodo decorativo del hub (`.touch-hub` con `.touch-hub-gem`) dentro del D-pad, con `aria-hidden`.
   - `ActionButton`: recibir además el índice para elegir letra (`A`/`B`) y clase (`.a`/`.b`); renderizar `<span className="touch-action-ring">` + `<span className="touch-action-letter">A|B</span>`; mover `label` a `aria-label`.
   - El root `<div className="touch-controls">` envuelve un `.gp-body` (grid 2 col) con la columna D-pad y la columna acciones.
2. **CSS del chasis y botones** en `app/globals.css` — reemplazar el bloque `.touch-controls`/`.touch-dpad*`/`.touch-actions`/`.touch-action-btn` actual por el estilo del gamepad neón (chasis con `::before`/`::after`, D-pad en cruz con relieve 3D y glow en `:active`/`.on`-equivalente, hub + `@keyframes pulse-led`, botones circulares A/B con anillo, gradientes y glow), usando los tokens del proyecto. Incluir estados `:hover`.
3. **Breakpoint móvil** — actualizar el `@media (max-width: 480px)` para el nuevo chasis (reducir padding del panel, tamaño del D-pad y diámetro de los A/B), tomando como guía el `@media (max-width: 620px)` de la referencia, y **verificando que HUD + canvas + gamepad entren sin scroll** en ~360–430px.
4. **Verificación** — `npm run lint` y `npm run build` sin errores; prueba visual en emulación móvil (Playwright, portrait) de los 4 reproductores comparando contra `gamepad-neon.png`, confirmando que el D-pad/A/B siguen jugando igual que antes y que no aparece scroll. Guardar capturas en `.playwright-screenshots/`.

## Acceptance criteria

- [ ] `TouchControls` se ve como `references/gamepad-assets/gamepad-neon.png`: chasis redondeado con glow, D-pad en cruz con flechas SVG y hub con gema pulsante, y botón(es) de acción circular(es) A/B.
- [ ] Las props de `TouchControls` (`directionMode`, `actions`) y toda su lógica de eventos sintéticos permanecen sin cambios; los 4 componentes motores no se tocan.
- [ ] El botón de acción muestra la letra `A` (magenta) para la primera acción y `B` (cyan) para la segunda; el texto original (p. ej. "DISPARAR") queda como `aria-label`.
- [ ] Los 4 reproductores (Asteroides, Tetris, Arkanoid, Serpiente) muestran el gamepad restilizado en emulación táctil y siguen siendo jugables solo con él, idéntico comportamiento que antes del spec.
- [ ] En portrait ~360–430px, HUD + canvas + gamepad caben sin scroll.
- [ ] La gema del hub pulsa (animación `pulse-led`) y el estado presionado (`:active`) muestra el glow neón en D-pad y A/B.
- [ ] En escritorio (sin `pointer: coarse`) `TouchControls` sigue sin renderizarse; teclado/mouse intactos.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** restyle sobre el `TouchControls` compartido existente (un solo lugar), en vez de duplicar por juego — coherente con la decisión de SPEC 10.
- **Sí:** botones de acción con letras A/B derivadas del índice; `label` → `aria-label`. Decisión explícita del usuario (fidelidad a la referencia), aceptando que el glifo visible ya no describe la acción.
- **Sí:** chasis completo (panel `.gp` con borde, textura y glow). Decisión explícita del usuario.
- **Sí:** incluir hub con gema pulsante y estados hover, pese a que hover casi nunca dispara en táctil puro. Decisión explícita del usuario (máxima fidelidad; los híbridos con mouse sí lo aprovechan).
- **Sí:** reutilizar los tokens de color del proyecto en vez de los hex crudos de la referencia (coinciden con la paleta de Arcade Vault).
- **Sí:** mantener el objetivo "sin scroll en portrait" de SPEC 10 como prioridad sobre replicar los tamaños de escritorio de la referencia. Decisión explícita del usuario.
- **No:** sincronizar el resaltado del D-pad con el teclado físico — fuera de alcance (queda como spec futura).
- **No:** cambios de comportamiento, de props, de los motores, del `.landscape-lock`, de datos/Supabase.

## Identified risks

| Risk                                                                                                                       | Mitigation                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El chasis con más padding/altura que el diseño plano actual podría romper el "sin scroll" en pantallas chicas (<360px).    | Recalibrar el `@media (max-width: 480px)` (y sumar un chequeo en ~320px) en el paso 3–4; reducir padding del panel y tamaño de botones hasta que entre. |
| Las animaciones/gradientes/box-shadows del gamepad podrían costar en GPUs móviles modestas durante el juego.               | Mantener la animación limitada a la gema (`transform`/`opacity`), sin animar el chasis; verificar fluidez en emulación en el paso 4.                    |
| Al cambiar el markup de `DirButton`/`ActionButton` se podría alterar sin querer los handlers de puntero y romper el input. | El paso 1 aísla los cambios a lo visual; `press`/`release`/`dispatchKey` no se tocan; verificación de jugabilidad idéntica en el paso 4.                |

## What is **not** in this spec

- Sincronización del resaltado visual del D-pad con el teclado físico.
- Cambios a `AsteroidsGame`/`TetrisGame`/`ArkanoidGame`/`SerpienteGame` o sus 5 props.
- Cambios al overlay `.landscape-lock` o su lógica.
- Cambios al mapeo por juego (`directionMode`/`actions`) en las 4 páginas `jugar/page.tsx`.
- Sonido, vibración háptica, tema claro/oscuro, datos/Supabase.

Cada uno de estos, si se implementa, va en su propia spec.
