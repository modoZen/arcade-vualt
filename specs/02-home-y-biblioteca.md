# SPEC 02 — Nuevo Home y reubicación de Biblioteca

> **Status:** Draft
> **Depends on:** SPEC 01 (rutas base, Nav, `app/data/games.ts`)
> **Date:** 2026-07-14
> **Objective:** Crear una nueva pantalla Home tipo landing en `/` (basada en `references/templates/home-about/home.jsx`), mover la pantalla Biblioteca de `/` a `/juego`, y agregar "Inicio" al Nav.

## Scope

**In:**

- Nueva pantalla Home en `app/page.tsx` (ruta `/`): hero, sección "por qué Arcade Vault", preview de 6 juegos desde `GAMES`, stats, actividad en vivo (hardcodeada), pricing decorativo, CTA final.
- Mover el contenido actual de Biblioteca de `app/page.tsx` a `app/juego/page.tsx` (nueva ruta `/juego`), sin cambios funcionales (mismo buscador, chips, grid).
- Actualizar `components/Nav.tsx`: agregar link "Inicio" → `/`, cambiar el destino de "Biblioteca" a `/juego`, actualizar `isActive()`.
- Portar a `app/globals.css` las clases CSS necesarias del home (`.home-hero`, `.feature-grid`, `.mini-rail`, `.home-stats`, `.activity-grid`, `.pricing-grid`, `.home-final`, etc.) desde `references/templates/home-about/styles.css`.
- Componentes decorativos del home (siluetas SVG, iconos pixel-art) viven localmente en `app/page.tsx`, igual patrón que Biblioteca hoy (pantalla = archivo de página, sin extraer a `components/` salvo que ya exista como `GameCard`).
- CTAs del home navegan con `next/link` o `useRouter` a `/juego`, `/auth`, `/salon`.

**Out of scope (para futuras specs):**

- Página "Acerca de" (`about.jsx` del template) y su link de Nav.
- Conectar actividad/top jugadores a `seededScores()` u otra fuente real.
- Cualquier lógica de backend, autenticación real, o cambios a `/juego/[id]` y `/juego/[id]/jugar` (quedan como están, solo cambia el prefijo de ruta padre).
- Cambios de diseño en Biblioteca, Detalle, Reproductor, Auth o Salón — se mueven/mantienen tal cual.

## Data model

Este spec no introduce estructuras de datos nuevas. Reutiliza `Game`, `GAMES` y `CATS` de `app/data/games.ts` (SPEC 01) para la sección de preview de juegos (`GAMES.slice(0, 6)`). Las secciones de actividad en vivo, top jugadores y pricing usan arrays locales hardcodeados dentro de `app/page.tsx`, idénticos en forma a los del template de referencia (no exportados, no persistidos).

## Implementation plan

1. Crear `app/juego/page.tsx` con el contenido actual de `app/page.tsx` (Biblioteca: hero, buscador, chips, grid) sin cambios funcionales.
2. Portar a `app/globals.css` las clases CSS del home tomadas de `references/templates/home-about/styles.css` (hero, silos flotantes, feature-grid, mini-rail, stats, activity-grid, pricing-grid, home-final).
3. Reemplazar `app/page.tsx` con el nuevo Home: sección Hero (título, subtítulo, CTAs "EXPLORAR JUEGOS" → `/juego` y "CREAR CUENTA" → `/auth`, siluetas SVG decorativas).
4. Agregar sección "Por qué Arcade Vault" (feature-grid con 4 tarjetas e iconos pixel-art) al Home.
5. Agregar sección "Juegos disponibles ahora" (mini-rail con `GAMES.slice(0, 6)`, cada card navega a `/juego/[id]`) y botón "VER TODOS LOS JUEGOS" → `/juego`.
6. Agregar sección de stats (3 bloques numéricos) y sección "Actividad en vivo" (ticker de puntuaciones + top jugadores hardcodeados, botón "VER SALÓN" → `/salon`).
7. Agregar sección Pricing (card única + FAQ) con CTA "EMPEZAR GRATIS" → `/auth`, y sección CTA final → `/juego`.
8. Actualizar `components/Nav.tsx`: agregar link "Inicio" apuntando a `/`, cambiar destino de "Biblioteca" a `/juego`, actualizar `isActive()` para distinguir `/` de `/juego` (y sus subrutas `/juego/[id]`).

## Acceptance criteria

- [ ] `/` carga sin errores en consola y muestra la nueva pantalla Home (hero, features, preview de juegos, stats, actividad, pricing, CTA final).
- [ ] `/juego` carga sin errores y muestra la pantalla Biblioteca (buscador, chips, grid) con el mismo comportamiento que tenía antes en `/`.
- [ ] El buscador y los chips de categoría en `/juego` siguen filtrando la grilla igual que antes.
- [ ] En el Home, el botón "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS" navegan a `/juego`.
- [ ] En el Home, el botón "CREAR CUENTA" y "EMPEZAR GRATIS" navegan a `/auth`.
- [ ] En el Home, el botón "VER SALÓN" navega a `/salon`.
- [ ] En el Home, cada mini-card de "Juegos disponibles ahora" navega a `/juego/[id]` del juego correspondiente.
- [ ] El CTA final ("INSERTAR MONEDA") navega a `/juego`.
- [ ] El Nav muestra 3 links: "Inicio", "Biblioteca", "Salón de la Fama".
- [ ] El link "Inicio" del Nav está activo (resaltado) en `/` y navega a `/`.
- [ ] El link "Biblioteca" del Nav está activo en `/juego` y en `/juego/[id]` y `/juego/[id]/jugar`, y navega a `/juego`.
- [ ] El logo del Nav sigue navegando a `/`.
- [ ] El menú móvil del Nav muestra los mismos 3 links y funciona igual que antes.

## Decisions

- **Sí:** mover Biblioteca de `/` a `/juego`, manteniendo la ruta hija `/juego/[id]` que ya existía. Evita romper la jerarquía de rutas de Detalle/Reproductor, que ya viven bajo `/juego/`.
- **No:** dejar Biblioteca en `/` y poner el Home en otra ruta (ej. `/inicio`). Contradice el pedido explícito: el Home debe vivir en `/` (raíz del sitio) y el nav debe tener "Inicio" apuntando ahí.
- **Sí:** actividad en vivo y top jugadores hardcodeados, igual que el template. No hay backend de actividad en tiempo real; agregar esa infraestructura está fuera del alcance de una maqueta estética.
- **No:** conectar esas secciones a `seededScores()`. Mezclaría datos "deterministas por seed" con una narrativa de "tiempo real" (marcas de tiempo tipo "hace 2 min"), lo cual sería engañoso sin backend real.
- **Sí:** los componentes decorativos del Home (siluetas SVG, iconos, mini-card) viven localmente en `app/page.tsx`, sin extraer a `components/`. Mismo patrón que Biblioteca hoy: pantalla = archivo de página; solo se extrae a `components/` lo reutilizable entre pantallas (como `GameCard` o `Nav`).
- **Sí:** "Acerca de" queda explícitamente fuera de este spec, aunque el template de referencia la incluya. Decisión tomada en la conversación: se prefiere un spec dedicado para no mezclar dos pantallas nuevas en un solo cambio.

## What is **not** in this spec

- Página "Acerca de" (`about.jsx` del template) y su link de Nav.
- Conectar actividad/top jugadores a `seededScores()` u otra fuente real.
- Backend, autenticación real, o cambios a `/juego/[id]` y `/juego/[id]/jugar`.
- Cambios de diseño en Biblioteca, Detalle, Reproductor, Auth o Salón.

Cada uno de estos, si se implementa, va en su propia spec.
