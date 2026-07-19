# SPEC 10 — Controles táctiles para dispositivos móviles

> **Status:** Borrador
> **Depends on:** SPEC 05 (Asteroides), SPEC 07 (Tetris), SPEC 08 (Arkanoid), SPEC 09 (Serpiente) — los 4 reproductores reales que este spec modifica
> **Date:** 2026-07-19
> **Objective:** Agregar un sistema de controles táctiles compartido (D-pad de 4 flechas + hasta 2 botones de acción, ocultando los que no aplican por juego) debajo del canvas de los 4 juegos reales del catálogo, mostrado automáticamente en dispositivos táctiles (detectados vía `pointer: coarse`) sin alterar el comportamiento de teclado/mouse en desktop, con layout ajustado para caber sin scroll en portrait y un aviso de "girá tu dispositivo" si se detecta landscape en un dispositivo táctil.

## Scope

**In:**

- Nuevo componente compartido `components/games/TouchControls.tsx` ("use client"): D-pad de 4 flechas + hasta 2 botones de acción, configurable por props (qué botones mostrar, iconos/labels, y qué `code` de teclado dispara cada uno). Mismo diseño visual en los 4 juegos.
- **Mecanismo de integración sin tocar los motores existentes**: `TouchControls` no se comunica con `AsteroidsGame`/`TetrisGame`/`ArkanoidGame`/`SerpienteGame` por props nuevas ni refs imperativos — en su lugar, al presionar/soltar un botón despacha `KeyboardEvent` sintéticos (`keydown`/`keyup`) sobre `window` con el mismo `code` que ya escuchan los listeners internos de cada juego (ej. `ArrowLeft`, `Space`). Esto significa que **los 4 componentes de juego no se modifican**: siguen recibiendo exactamente sus 5 props actuales, ajenos a si el input vino de teclado real o de un botón táctil.
- Manejo de "mantener presionado":
  - Para Asteroides/Arkanoid (estado `keys[...]` leído en el loop): un `keydown` sintético al presionar, `keyup` sintético al soltar/cancelar — igual semántica que una tecla física mantenida.
  - Para Tetris (depende del auto-repeat nativo del navegador en `keydown`): mientras el botón se mantiene presionado, `TouchControls` despacha `keydown` sintéticos repetidos a intervalo fijo (delay inicial + repetición), simulando el auto-repeat del SO; los botones de acción (hard drop) disparan un solo `keydown` por tap.
  - Para Serpiente (un solo `keydown` cambia la dirección siguiente): un tap dispara un `keydown` sintético único, sin repetición.
- Detección de dispositivo táctil vía media query `(pointer: coarse) and (hover: none)`, aplicada tanto para mostrar/ocultar `TouchControls` como para el aviso de landscape.
- Aviso "Girá tu dispositivo a vertical" (overlay CSS-only, sin JS de por medio) mostrado vía `@media (pointer: coarse) and (orientation: landscape)`, cubriendo el juego mientras el dispositivo táctil esté en landscape.
- Ajustes de layout en los 4 `app/juego/<slug>/jugar/page.tsx` para que HUD + canvas + `TouchControls` quepan sin scroll en portrait en anchos típicos de celular (~360–430px): reducir paddings/tamaños de fuente del HUD y del `.crt` en ese breakpoint, y renderizar `<TouchControls>` debajo del `.crt` (no superpuesto al canvas), cada uno con su mapeo de botones:
  - Asteroides: D-pad (←/→ rota, ↑ empuje, ↓ sin uso) + 1 botón de acción (disparar, `Space`).
  - Tetris: D-pad (←/→ mueve, ↑ rota, ↓ soft drop) + 1 botón de acción (hard drop, `Space`).
  - Arkanoid: D-pad (←/→ mueve paleta, ↑/↓ sin uso) + 0 botones de acción.
  - Serpiente: D-pad (4 direcciones) + 0 botones de acción.
- Botones de acción no usados por un juego quedan ocultos (no renderizados), no solo deshabilitados.
- Estilos nuevos en `app/globals.css` para `TouchControls`, el overlay de landscape, y los ajustes de breakpoint mobile del `.av-player`/`.player-hud`/`.crt`.
- `touch-action: none` y manejo de `pointercancel`/`pointerleave` en los botones para evitar scroll/zoom accidental y liberar el botón si el dedo se desliza fuera mientras está presionado.

**Out of scope (para futuras specs):**

- Landscape jugable (solo se avisa que rote el dispositivo; no se adapta el layout a horizontal).
- Gestos táctiles (swipe/drag) — descartado a favor de D-pad + botones, según lo definido.
- Vibración háptica o sonido en los botones táctiles.
- Cualquier cambio al mapeo o comportamiento de teclado/mouse en desktop.
- Cambios a páginas fuera de `/juego/<slug>/jugar` (Home, Biblioteca, Detalle, Salón de la Fama) — se asume que ya son razonablemente responsive vía Tailwind.
- Accesibilidad para lectores de pantalla más allá de `aria-label` básicos en los botones.
- Tema claro/oscuro.
- Cambios a datos/Supabase — este spec es 100% cliente, sin nueva fila ni columna.

## Data model

No hay cambios de datos en Supabase — este spec es 100% cliente. Lo que sí se introduce son las estructuras TypeScript del componente compartido y su instanciación por juego.

**1. Props de `TouchControls`** (`components/games/TouchControls.tsx`):

```ts
type DirectionMode = "hold" | "repeat" | "tap";

interface TouchActionConfig {
  code: string; // KeyboardEvent.code a despachar, ej. "Space"
  label: string; // texto/ícono corto del botón, ej. "DISPARAR"
}

interface TouchControlsProps {
  directionMode: DirectionMode;
  actions?: TouchActionConfig[]; // 0–2 botones de acción; si se omite, no se renderiza el lado de acciones
}
```

- El D-pad **no es configurable**: siempre despacha `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` (los 4 juegos ya escuchan exactamente esos `code`, aunque alguna dirección sea un no-op para ese juego en particular — ej. `ArrowDown` en Arkanoid).
- `directionMode` controla cómo se despachan los eventos sintéticos del D-pad al presionar/soltar:
  - `"hold"` (Asteroides, Arkanoid): `keydown` sintético al presionar, `keyup` sintético al soltar/cancelar — replica una tecla física mantenida, para motores que leen un estado `keys[...]` en el loop.
  - `"repeat"` (Tetris): `keydown` inmediato al presionar y, si se mantiene más de `TOUCH_REPEAT_DELAY_MS` (300ms), `keydown` repetidos cada `TOUCH_REPEAT_INTERVAL_MS` (60ms) hasta soltar — replica el auto-repeat nativo del navegador que el motor ya asume.
  - `"tap"` (Serpiente): un solo `keydown` sintético por toque, sin `keyup` — replica el patrón de "una tecla cambia la dirección siguiente".
- Los botones de `actions` siempre despachan en modo `"tap"` (un `keydown` por toque), independientemente del `directionMode` del D-pad.
- Todos los eventos se despachan con `window.dispatchEvent(new KeyboardEvent("keydown", { code }))` (y `"keyup"` cuando aplica) — mismo `code` que ya manejan los listeners internos de cada juego; **ningún componente de juego cambia**.

**2. Instanciación por juego** (dentro de cada `app/juego/<slug>/jugar/page.tsx`, debajo del `.crt`):

```tsx
// Asteroides
<TouchControls directionMode="hold" actions={[{ code: "Space", label: "DISPARAR" }]} />

// Tetris
<TouchControls directionMode="repeat" actions={[{ code: "Space", label: "CAER" }]} />

// Arkanoid
<TouchControls directionMode="hold" />

// Serpiente
<TouchControls directionMode="tap" />
```

**3. Clases CSS nuevas** en `app/globals.css`: `.touch-controls` (contenedor flex, D-pad a la izquierda / acciones a la derecha), `.touch-dpad`, `.touch-dpad-btn`, `.touch-actions`, `.touch-action-btn` (todas con `touch-action: none`), y `.landscape-lock` (overlay full-screen mostrado solo vía `@media (pointer: coarse) and (orientation: landscape)`).

## Implementation plan

1. Crear `components/games/TouchControls.tsx` ("use client"): D-pad de 4 flechas + hasta 2 botones de acción (props `directionMode`/`actions` del Data model). Usa Pointer Events (`pointerdown`/`pointerup`/`pointercancel`/`pointerleave`) para despachar los `KeyboardEvent` sintéticos en `window`, con la lógica de `"hold"`/`"repeat"`/`"tap"` descrita arriba. Internamente detecta si mostrarse o no vía media query `(pointer: coarse) and (hover: none)` (hook/helper `useIsTouchDevice` colocado en el mismo archivo); si no es táctil, no renderiza nada.
2. Agregar a `app/globals.css`: estilos de `.touch-controls`/`.touch-dpad`/`.touch-dpad-btn`/`.touch-actions`/`.touch-action-btn` (con `touch-action: none`), el overlay `.landscape-lock` (mostrado solo vía `@media (pointer: coarse) and (orientation: landscape)`), y el breakpoint mobile compacto para `.av-player`/`.player-hud`/`.crt`/`.crt-fixed` que reduce paddings/tamaños de fuente para que todo quepa sin scroll en portrait (~360–430px de ancho). En este paso `TouchControls` ya se puede probar de forma aislada (sin estar aún wireado a ningún juego).
3. Wirear `TouchControls` en `app/juego/asteroides/jugar/page.tsx` (`directionMode="hold"`, acción "disparar") debajo del `.crt`, agregar `.landscape-lock` al JSX. Verificar en emulación móvil (Playwright, portrait) que el D-pad rota/empuja la nave y el botón dispara, igual que el teclado.
4. Wirear `TouchControls` en `app/juego/tetris/jugar/page.tsx` (`directionMode="repeat"`, acción "caer"). Verificar que mantener presionado ←/→/↓ mueve la pieza repetidamente (no solo un paso), ↑ rota, y el botón de acción hace hard drop.
5. Wirear `TouchControls` en `app/juego/arkanoid/jugar/page.tsx` (`directionMode="hold"`, sin acciones). Verificar que ←/→ mueven la paleta de forma continua mientras se mantiene presionado.
6. Wirear `TouchControls` en `app/juego/serpiente/jugar/page.tsx` (`directionMode="tap"`, sin acciones). Verificar que cada tap cambia de dirección sin permitir el giro de 180° (la guarda ya existe en el motor, sin cambios).
7. Verificación final: `tsc --noEmit` y `npm run build` sin errores. En Playwright con emulación de un dispositivo móvil (portrait): confirmar que los 4 juegos son jugables solo con `TouchControls` (sin teclado/mouse), que HUD+canvas+controles caben sin scroll, que rotar a landscape muestra `.landscape-lock` y oculta el juego, y que en un viewport de escritorio (sin `pointer: coarse`) no aparece ningún control táctil y el teclado/mouse funcionan exactamente igual que antes. Guardar capturas en `.playwright-screenshots/`.

## Acceptance criteria

- [ ] `components/games/TouchControls.tsx` existe, exporta el componente con props `directionMode`/`actions`, y no se renderiza en dispositivos sin `pointer: coarse`.
- [ ] Ninguno de los 4 componentes de juego (`AsteroidsGame.tsx`, `TetrisGame.tsx`, `ArkanoidGame.tsx`, `SerpienteGame.tsx`) cambia sus props ni su lógica interna — siguen aceptando exactamente las mismas 5 props.
- [ ] En emulación de dispositivo táctil portrait, `/juego/asteroides/jugar` muestra `TouchControls` debajo del `.crt`; el D-pad rota la nave (←/→) y la empuja (↑); el botón de acción dispara; el comportamiento es indistinguible del control por teclado.
- [ ] En emulación táctil portrait, `/juego/tetris/jugar` muestra `TouchControls`; mantener presionado ←/→/↓ mueve/baja la pieza repetidamente (no un solo paso); ↑ rota; el botón de acción hace hard drop.
- [ ] En emulación táctil portrait, `/juego/arkanoid/jugar` muestra `TouchControls` (sin botones de acción visibles); ←/→ mueven la paleta de forma continua mientras se mantiene presionado.
- [ ] En emulación táctil portrait, `/juego/serpiente/jugar` muestra `TouchControls` (sin botones de acción visibles); cada tap de dirección mueve la serpiente sin permitir invertir 180° sobre el cuello.
- [ ] En los 4 reproductores, HUD + canvas + `TouchControls` caben en la pantalla de un celular típico en portrait sin necesidad de scroll.
- [ ] En emulación táctil landscape, cada uno de los 4 reproductores muestra el overlay "Girá tu dispositivo a vertical" (`.landscape-lock`) en vez del juego.
- [ ] En un viewport de escritorio (sin `pointer: coarse`), `TouchControls` no se renderiza en ninguno de los 4 reproductores, y el teclado (y el mouse en Arkanoid) siguen funcionando exactamente igual que antes de este spec.
- [ ] Soltar un botón mientras el dedo se desliza fuera de su área (`pointercancel`/`pointerleave`) libera el estado igual que soltarlo normalmente (no queda una dirección "trabada" presionada).
- [ ] El resto de la plataforma (Home, Biblioteca, Detalle, Salón de la Fama) no cambia de comportamiento.
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** cubrir los 4 juegos reales (Asteroides, Tetris, Arkanoid, Serpiente) en un solo spec, en vez de hacerlo juego por juego en specs separados. Decisión explícita del usuario.
- **Sí:** controles táctiles como D-pad (4 flechas) + botones de acción, en vez de gestos (swipe/drag/tap). Decisión explícita del usuario, basada en la referencia visual compartida.
- **Sí:** D-pad fijo de 4 flechas + **máximo 2** botones de acción (no 4), ocultando los botones de acción que un juego no usa en vez de mostrarlos deshabilitados. Decisión explícita del usuario, ajustada durante la Fase 2 (la referencia visual inicial mostraba un diamante de 4).
- **Sí:** `TouchControls` como componente compartido único, en vez de 4 implementaciones independientes copiadas. Decisión explícita del usuario — el diseño visual es idéntico en los 4 juegos, así que mantenerlo en un solo lugar evita que se desincronice entre juegos. Desviación consciente del criterio "cada juego real es autocontenido" del resto del proyecto: acá aplica solo a la UI de controles, no al motor de cada juego.
- **Sí:** los controles se renderizan **debajo** del canvas, no superpuestos — para no tapar el área de juego con el pulgar. Decisión explícita del usuario, revirtiendo el layout superpuesto sugerido por la referencia visual inicial.
- **Sí:** integración por eventos de teclado sintéticos (`window.dispatchEvent(new KeyboardEvent(...))`) en vez de props nuevas o refs imperativos en los componentes de juego. Decisión de diseño para no tocar ningún motor existente (`AsteroidsGame`/`TetrisGame`/`ArkanoidGame`/`SerpienteGame` no cambian), reduciendo drásticamente el riesgo de regresión en los 4 juegos ya implementados.
- **Sí:** `directionMode` por juego (`"hold"`/`"repeat"`/`"tap"`) para replicar la semántica de input real que cada motor ya asume (estado mantenido vs auto-repeat del navegador vs tecla única), en vez de un único modo genérico que no encajaría con los 4 motores.
- **Sí:** Arkanoid usa D-pad ←/→ para la paleta en móvil (no drag/arrastre táctil como el mouse en desktop). Decisión explícita del usuario — prioriza consistencia visual con los otros 3 juegos por sobre la precisión que daría el drag.
- **Sí:** detección de dispositivo táctil vía media query `(pointer: coarse) and (hover: none)`, en vez de un breakpoint de ancho de pantalla. Decisión explícita del usuario (recomendada) — distingue touch real de una ventana de escritorio angosta.
- **Sí:** soporte de orientación **solo portrait**; en landscape sobre un dispositivo táctil se muestra un aviso pidiendo rotar, en vez de adaptar el layout a horizontal o dejarlo sin manejar. Decisión explícita del usuario.
- **Sí:** el aviso de landscape se implementa 100% con CSS (`@media (pointer: coarse) and (orientation: landscape)`), sin JS de por medio, por simplicidad y para que no dependa de listeners de resize/orientación.
- **Sí:** HUD + canvas + controles deben caber sin scroll en portrait en anchos típicos de celular. Decisión explícita del usuario (recomendada) — scrollear mientras se juega con el pulgar es mala UX.
- **Sí:** el teclado sigue funcionando igual en dispositivos híbridos (no se deshabilita si aparece `TouchControls`); ambos esquemas de input conviven sin conflicto porque el táctil solo despacha los mismos eventos de teclado que ya existen.
- **No:** soporte de landscape jugable, gestos táctiles, vibración háptica/sonido en los botones, accesibilidad para lectores de pantalla más allá de `aria-label` básicos, tema claro/oscuro, y cambios a páginas fuera de `/juego/<slug>/jugar` — ninguno pedido por el usuario; quedan fuera de alcance explícito.
- **No:** cambios de datos en Supabase — spec 100% cliente.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                                                                                                                                  | Mitigation                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los navegadores no auto-repiten `KeyboardEvent` sintéticos (solo eventos de teclado reales generan repetición automática por el SO); si el temporizador de `directionMode="repeat"` de Tetris queda mal calibrado, mantener presionado ←/→/↓ puede sentirse más lento o más rápido que con teclado físico.                                                                                            | Verificación manual explícita en el paso 4 del plan: comparar la velocidad percibida de movimiento sostenido por touch contra teclado, y ajustar `TOUCH_REPEAT_DELAY_MS`/`TOUCH_REPEAT_INTERVAL_MS` si se siente distinto.                                                            |
| Los 4 motores ya tienen `preventDefault()` en sus propios listeners de `keydown` para las flechas reales; un `KeyboardEvent` sintético despachado sin `cancelable`/sin estar atado a un evento de usuario real podría comportarse distinto en algún navegador (aunque los engines no dependen de `preventDefault()` para funcionar, solo lo usan para evitar scroll de la página con teclado físico). | Los eventos sintéticos se despachan solo para que los `switch`/`if (keys[...])` internos reaccionen al `code`; no se depende de que `preventDefault()` tenga efecto en el evento sintético. Verificación manual en cada paso 3–6 de que el juego responde igual que con teclado real. |
| Si el dedo se desliza fuera de un botón mientras está presionado sin disparar `pointerup` (algunos navegadores móviles no siempre emiten `pointerleave`/`pointercancel` de forma consistente), una dirección podría quedar "trabada" activa indefinidamente.                                                                                                                                          | Escuchar tanto `pointerup` como `pointercancel` y `pointerleave` para liberar el estado, y verificar explícitamente ese caso (arrastrar el dedo fuera del botón) en el paso 7 del plan.                                                                                               |
| El breakpoint mobile compacto para `.player-hud`/`.crt` puede no ser suficiente para pantallas muy chicas (ej. celulares con viewport <360px de ancho), dejando el `TouchControls` cortado o forzando scroll pese al objetivo de que todo quepa.                                                                                                                                                      | Probar en el paso 7 con al menos un perfil de emulación de pantalla chica (ej. iPhone SE o similar) además del dispositivo principal, y ajustar el breakpoint/tamaños si no entra.                                                                                                    |
| `pointer: coarse` también es verdadero en algunas laptops con pantalla táctil híbrida (touch + trackpad); esos usuarios verían `TouchControls` aunque prefieran jugar con teclado.                                                                                                                                                                                                                    | Riesgo aceptado explícitamente — coincide con el criterio de detección elegido por el usuario (recomendado sobre un breakpoint de ancho); el teclado sigue funcionando en paralelo sin conflicto, así que no bloquea a ese usuario, solo agrega un control adicional en pantalla.     |

## What is **not** in this spec

- Landscape jugable.
- Gestos táctiles (swipe/drag).
- Vibración háptica o sonido en los botones táctiles.
- Cambios al mapeo o comportamiento de teclado/mouse en desktop.
- Cambios a páginas fuera de `/juego/<slug>/jugar`.
- Accesibilidad para lectores de pantalla más allá de `aria-label` básicos.
- Tema claro/oscuro.
- Cambios a datos/Supabase.

Cada uno de estos, si se implementa, va en su propia spec.
