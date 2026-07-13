# SPEC 01 — Pantallas visuales del MVP

> **Status:** Approved
> **Depends on:** Ninguno (usa el theme/layout base ya presente en `app/globals.css` y `app/layout.tsx`)
> **Date:** 2026-07-13
> **Objective:** Portar las 5 pantallas del prototipo estático (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama) a rutas reales de Next.js App Router, con datos ficticios centralizados en `app/data` y sesión de usuario simulada vía Context, sin implementar lógica de juego real.

## Scope

**In:**

- 5 rutas reales de Next.js App Router: `/` (Biblioteca), `/juego/[id]` (Detalle), `/juego/[id]/jugar` (Reproductor), `/auth` (Auth), `/salon` (Salón de la Fama).
- `Nav` (con menú móvil) y el footer, montados una sola vez en `app/layout.tsx` para que persistan entre rutas.
- `app/data/games.ts` con `GAMES` y `CATS` portados 1:1 desde `data.jsx`, tipados.
- `app/data/scores.ts` con `PLAYERS`, `ScoreRow` y `seededScores()`.
- `AuthContext` (`app/context/AuthContext.tsx`): expone `user`, `login(name)`, `signOut()`; persiste en `localStorage` bajo `av_user`; sin validar credenciales.
- Pantalla Reproductor con la simulación decorativa del template: puntaje incremental por `setInterval`, subida de nivel, pausa, fin de partida, modal con marca de "guardado" en estado local (sin persistencia).
- Todos los estados visuales del template: tilt de las cards al hover, buscador y chips de categoría en Biblioteca, tabs por juego + podio + tabla en Salón de la Fama, leaderboard mock en Detalle vía `seededScores()`.
- Botones sociales (Google/GitHub) en Auth, puramente decorativos.

**Out of scope (para futuras specs):**

- Lógica de juego real (mecánica, colisiones, físicas) para cualquiera de los 8 juegos del catálogo.
- Backend, API o base de datos — los datos siguen siendo estáticos en `app/data`.
- Autenticación real (passwords, OAuth, validación de email) — login queda tal como en el template, sin verificación.
- Persistencia de la puntuación jugada (ni escritura ni lectura) — el guardado en el modal de fin de partida es puramente un cambio de estado visual (`saved: true`), sin tocar `localStorage`.
- Rutas protegidas / redirect si no hay sesión.
- Audio/sonido.
- Multijugador o tiempo real.
- Internacionalización (queda solo en español, como el template).

## Data model

```ts
// app/data/games.ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[];
export const CATS: readonly string[];
```

```ts
// app/data/scores.ts
export const PLAYERS: readonly string[];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/YYYY"
}

export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// app/context/AuthContext.tsx
interface AuthContextValue {
  user: string | null;
  login: (name: string) => void;
  signOut: () => void;
}
```

Convenciones:

- `Game.id` es el slug usado en la ruta `/juego/[id]`.
- `seededScores` es determinista (mismo seed → mismas filas), igual que en el template.
- `av_user` es la misma clave de `localStorage` que ya usaba el prototipo para la sesión.
- `user` es `null` cuando no hay sesión; logueado (real o invitado) es el string con el nombre.
- El botón "JUGAR COMO INVITADO" llama `login("INVITADO")`.
- El botón "GUARDAR PUNTUACIÓN" del Reproductor solo cambia un estado local (`saved: true`) para mostrar el toast; no persiste en `localStorage`.

## Implementation plan

1. Crear `app/data/games.ts` con el tipo `Game`, `GAMES` (8 juegos) y `CATS`, portados desde `data.jsx`.
2. Crear `app/data/scores.ts` con `PLAYERS`, `ScoreRow` y `seededScores()`.
3. Crear `app/context/AuthContext.tsx` (`AuthProvider` + hook `useAuth`) y envolver `children` con `<AuthProvider>` en `app/layout.tsx`.
4. Crear `components/Nav.tsx` (nav desktop + panel móvil, usa `useAuth()` y `usePathname()` para el estado activo) y montarlo junto al footer en `app/layout.tsx`, dentro de `<AuthProvider>`.
5. Crear `components/GameCard.tsx` (cover, badge de mejor puntuación, botón JUGAR, efecto tilt al hover).
6. Reemplazar `app/page.tsx` por la pantalla Biblioteca: hero, buscador, chips de `CATS`, grid de `GameCard` filtrado por texto/categoría.
7. Crear `app/juego/[id]/page.tsx` — pantalla Detalle: cover, tags, stats, botones (JUGAR AHORA → `/juego/[id]/jugar`, VOLVER AL VAULT → `/`), leaderboard con `seededScores()`; `notFound()` si el `id` no existe en `GAMES`.
8. Crear `app/juego/[id]/jugar/page.tsx` — pantalla Reproductor: HUD (jugador/puntaje/vidas/nivel), simulación de puntaje por `setInterval`, subida de nivel, pausa, botón FIN, modal de fin de partida con input de iniciales y botón que marca `saved: true` (estado local, sin persistencia).
9. Crear `app/auth/page.tsx` — pantalla Auth: tabs "Iniciar sesión"/"Crear cuenta", formulario que llama `useAuth().login(nombre)` y redirige a `/`, botón invitado que llama `login("INVITADO")`, botones sociales decorativos sin `onClick`.
10. Crear `app/salon/page.tsx` — pantalla Salón de la Fama: tabs por juego (`GAMES`), podio (top 3), tabla completa vía `seededScores()`, fila "tu mejor marca" cuando `user` no es `null`.

## Acceptance criteria

- [ ] La app compila y `/` carga sin errores en consola, mostrando la pantalla Biblioteca.
- [ ] El buscador en Biblioteca filtra la grilla por título en tiempo real.
- [ ] Los chips de categoría en Biblioteca (incluyendo "TODOS") filtran la grilla.
- [ ] Click en una card o en su botón "JUGAR" navega a `/juego/[id]` del juego correspondiente.
- [ ] Visitar `/juego/id-inexistente` muestra la página 404 de Next.js.
- [ ] `/juego/[id]` muestra cover, tags, descripción larga, stats (partidas, mejor global, dificultad) y la tabla de mejores puntuaciones vía `seededScores`.
- [ ] El botón "JUGAR AHORA" en Detalle navega a `/juego/[id]/jugar`.
- [ ] El botón "VOLVER AL VAULT" en Detalle navega a `/`.
- [ ] `/juego/[id]/jugar` incrementa el puntaje automáticamente mientras no está pausado ni terminado.
- [ ] El botón "PAUSA" detiene el incremento de puntaje y cambia su texto a "REANUDAR".
- [ ] El botón "FIN" abre el modal de fin de partida con el puntaje final.
- [ ] Guardar la puntuación en el modal muestra el toast "PUNTUACIÓN GUARDADA" (sin persistir en `localStorage`).
- [ ] "JUGAR DE NUEVO" reinicia puntaje, vidas, nivel y cierra el modal.
- [ ] "VOLVER AL VAULT" desde el modal navega a `/`.
- [ ] `/auth` permite enviar el formulario de login con cualquier texto (o vacío) y redirige a `/` con el usuario logueado en el Nav.
- [ ] El botón "JUGAR COMO INVITADO" en `/auth` loguea como "INVITADO" y redirige a `/`.
- [ ] Los botones sociales (GOOGLE/GITHUB) en `/auth` no ejecutan ninguna acción.
- [ ] Con sesión activa, el Nav muestra `{user} ▾`; al hacer click cierra sesión y vuelve a mostrar "Iniciar Sesión".
- [ ] Recargar la página mantiene la sesión (persistencia en `localStorage["av_user"]`).
- [ ] `/salon` muestra tabs por cada juego de `GAMES`, un podio (top 3) y una tabla completa vía `seededScores`.
- [ ] Con sesión activa, `/salon` muestra la fila "tu mejor marca" al final de la tabla; sin sesión, no aparece.
- [ ] El menú móvil (hamburguesa) del Nav abre/cierra el panel lateral en pantallas angostas.
- [ ] El enlace del logo en el Nav navega a `/` desde cualquier pantalla.

## Decisions

- **Sí:** rutas reales de Next.js App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/auth`, `/salon`) en vez de hash-routing sobre una sola página. Es el patrón idiomático de App Router y evita reimplementar un router a mano.
- **No:** mantener el hash-router (`location.hash` + `JSON.parse`) del prototipo. Innecesario y no idiomático en Next.js.
- **Sí:** mantener la simulación decorativa del Reproductor (`setInterval` incrementando puntaje) tal cual el template. No es lógica de juego real, solo vende la pantalla.
- **No:** dejar el Reproductor totalmente estático sin simulación. Se pierde la sensación de "pantalla en uso".
- **Sí:** login sin validación (cualquier texto, incluso vacío), igual que el prototipo. Es MVP visual, aún no hay backend de autenticación.
- **No:** agregar validación de formulario (required, formato email, etc.). Fuera del alcance visual definido.
- **Sí:** botones sociales (GOOGLE/GITHUB) puramente decorativos, sin `onClick`. No hay integración OAuth real.
- **No:** persistir la puntuación guardada en el Reproductor (`av_scores` en `localStorage`). Al revisar el template de referencia se notó que `onSaveScore` se inyecta como prop opcional y el propio componente solo necesita pasar a estado `saved: true` para mostrar el toast — agregar una escritura a `localStorage` que nadie lee de vuelta era complejidad sin beneficio para este MVP.
- **Sí:** "GUARDAR PUNTUACIÓN" en el Reproductor es solo un cambio de estado local (`saved`), sin ningún efecto persistente. Si en una spec futura se agrega backend/lectura real de scores, se resuelve ahí.
- **Sí:** `user` en `AuthContext` es `string | null` (el nombre directo), no un objeto. Simplifica el tipado ya que por ahora no hay más campos de usuario.
- **Sí:** invitado inicia sesión con nombre por defecto `"INVITADO"` vía `login("INVITADO")`, en vez de quedar con `user: null`. Decisión tomada explícitamente en la conversación — cambia el comportamiento original del template (que dejaba al invitado sin sesión).
- **Sí:** `PLAYERS`, `ScoreRow` y `seededScores` viven en `app/data/scores.ts`, separados de `Game`/`GAMES`/`CATS` en `app/data/games.ts`. `PLAYERS` solo lo usa el generador de scores, no el catálogo de juegos.
- **No:** una única sesión de auth compartida con `app/data`. El auth vive en su propio `AuthContext`, separado de los datos ficticios de catálogo/scores.

## Risks

| Risk | Mitigation |
| --- | --- |
| `localStorage` no existe durante el render en servidor (Next.js hace SSR) — leerlo directamente en el cuerpo de un componente revienta con `ReferenceError`. | El único acceso a `localStorage` (en `AuthContext`, para `av_user`) va dentro de `useEffect` o detrás de un check `typeof window !== "undefined"`, y ese componente se marca `"use client"`. |
| Mismatch de hidratación: el servidor renderiza sin sesión (`user: null`) pero el cliente lee `localStorage` de forma síncrona en el inicializador de `useState` — el primer render del cliente puede no coincidir con el del servidor si había sesión guardada, y React puede tirar warning de hidratación / re-renderizar ese fragmento. | Se acepta este riesgo como trade-off temporal: es una lectura simple y familiar, y esta lógica de `AuthContext` es provisoria — se reemplaza cuando la sesión venga de una API externa real, momento en el que dejará de depender de leer `localStorage` en el render. |
| Next.js `16.2.10` no es la versión de tu training data (lo aclara `AGENTS.md`) — cosas como los `params` de rutas dinámicas (`app/juego/[id]/page.tsx`) pueden ser una `Promise` a diferencia de versiones anteriores, o haber cambios de convención en `notFound()`. | Antes de implementar el paso 7 y 8 del plan, revisar `node_modules/next/dist/docs/01-app/` para la API vigente de rutas dinámicas en esta versión, en vez de asumir la de entrenamiento. |

## What is **not** in this spec

- Lógica de juego real (mecánica, colisiones, físicas) para cualquiera de los 8 juegos del catálogo.
- Backend, API o base de datos — los datos siguen siendo estáticos en `app/data`.
- Autenticación real (passwords, OAuth, validación de email).
- Persistencia de la puntuación jugada (el guardado en el Reproductor es un estado visual, no toca `localStorage`).
- Rutas protegidas / redirect si no hay sesión.
- Audio/sonido.
- Multijugador o tiempo real.
- Internacionalización.

Cada uno de estos, si se implementa, va en su propia spec.
