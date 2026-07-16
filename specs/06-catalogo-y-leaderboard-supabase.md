# SPEC 06 — Catálogo de juegos y leaderboard reales en Supabase

> **Status:** Draft
> **Depends on:** SPEC 04 (clientes de Supabase configurados), SPEC 05 (juego real de Asteroides, único juego que conecta a este leaderboard)
> **Date:** 2026-07-16
> **Objective:** Reemplazar el array estático `GAMES` y el leaderboard simulado (`seededScores`) por dos tablas reales en Supabase (`games` y `scores`), con guardado real de puntuación conectado únicamente a Asteroides y dos vistas de leaderboard (global y por juego).

## Scope

**In:**

- Migración en Supabase (vía `mcp__supabase__apply_migration`) que crea la tabla `games` (reemplaza a `app/data/games.ts`) y la tabla `scores` (reemplaza a `app/data/scores.ts`).
- Seed de `games` en la propia migración con **un solo registro: Asteroides** (el único juego real hoy). Los 7 juegos decorativos actuales (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) **no se migran** a Supabase.
- `games` no tiene columna `best`, `plays` ni `playable`. Es de solo lectura para la app (sin INSERT/UPDATE/DELETE desde ningún rol) — sin trigger. `best` y `plays` se calculan en tiempo de consulta (`MAX(score)` / `COUNT(*)` sobre `scores` filtrado por `game_id`).
- `app/data/games.ts` y `app/data/scores.ts` se eliminan. Se crean helpers tipados en `lib/supabase/` para leer `games` (lista y por id, con `best`/`plays` calculados) y leer/escribir `scores`.
- Home (`/`), Biblioteca (`/juego`), Detalle (`/juego/[id]`) pasan a leer el catálogo desde Supabase. Como consecuencia directa, el catálogo visible queda reducido a **una sola card: Asteroides**.
- El botón "GUARDAR PUNTUACIÓN" en `app/juego/asteroides/jugar/page.tsx` inserta de verdad en `scores` (`game_id`, `player_name`, `score`, `user_id: null`). El nombre tecleado se guarda en `localStorage` (clave propia, independiente de `AuthContext`) y precarga el input la próxima vez.
- `/salon` (Hall of Fame): dos vistas — **global** (top 10 de `scores` mezclando todos los juegos existentes en `games`, mostrando de qué juego es cada entrada) y **por juego** (un tab por cada fila de `games`; hoy solo Asteroides), también top 10. Se elimina `seededScores` y los datos falsos.
- El sidebar "MEJORES PUNTUACIONES" de la pantalla Detalle (`/juego/asteroides`) muestra datos reales de `scores` (top 10).
- Estado vacío consistente en las tres vistas de leaderboard (global, por juego en Salón, sidebar de Detalle): mensaje "SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA" cuando no hay scores para ese juego.
- Todas las vistas de leaderboard quedan fijas en **top 10**, sin paginar.

**Out of scope (para futuras specs):**

- Autenticación real con Supabase Auth (`user_id` queda `NULL` siempre en este spec).
- Migrar o mantener accesibles de alguna forma los 7 juegos decorativos (redirect, mensaje especial, preservar el array local como fallback, etc.). Al leer el catálogo solo desde Supabase, `/juego/rocas`, `/juego/bloque-buster`, etc. simplemente devuelven `notFound()` como efecto colateral — no es una entrega de este spec, ni se diseña nada especial para ese caso. El código genérico del Reproductor (`app/juego/[id]/jugar/page.tsx`) se queda intacto por si una spec futura siembra otro juego real.
- **RLS (Row Level Security):** la migración de este spec **no habilita RLS** en `games` ni `scores`. El acceso se resuelve con grants simples a los roles `anon`/`authenticated` (lectura en ambas tablas, inserción en `scores`). Políticas de RLS reales quedan para un spec futuro de seguridad.
- **Realtime:** los leaderboards no se actualizan en vivo — se cargan una sola vez al entrar a la pantalla, sin suscripción a cambios (`postgres_changes`/websockets).
- **Paginación:** top 10 fijo en las tres vistas, sin "ver más" ni scroll infinito.
- UI de administración para crear/editar/borrar juegos del catálogo (la tabla `games` se puebla solo vía la migración inicial).
- Validación anti-cheat de puntuaciones (rate limiting, límites de score razonables, etc.).
- Cualquier sistema real de "créditos" (el texto "CRÉDITOS · 03" del Nav sigue siendo decorativo).

## Data model

**Tabla `games`** (Supabase, reemplaza `app/data/games.ts`):

```sql
create table games (
  id text primary key,              -- slug, ej. "asteroides" (igual que game.id hoy)
  title text not null,
  short text not null,
  long text not null,
  cat text not null,                -- "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover text not null,              -- nombre de clase CSS, ej. "cover-asteroides"
  color text not null               -- "cyan" | "magenta" | "yellow" | "green"
);
-- seed: un solo insert, la fila de "asteroides" con los valores actuales de SPEC 05
```

Sin `best`, `plays` ni `playable` — los dos primeros se calculan en consulta, el tercero se dropeó por no filtrar nada con una sola fila.

**Tabla `scores`** (Supabase, reemplaza `app/data/scores.ts` / `seededScores`):

```sql
create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games(id),
  player_name text not null,
  score integer not null,
  user_id uuid references auth.users(id),  -- nullable, siempre NULL en este spec
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on scores (game_id, score desc);
create index scores_score_idx on scores (score desc);
```

**Cálculo de `best` / `plays`** (en consulta, no almacenados):

```sql
select max(score) as best, count(*) as plays from scores where game_id = $1;
```

**Tipos nuevos** (`lib/supabase/types.ts`):

```ts
interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number | null;
  plays: number; // ambos calculados, no almacenados
}

interface ScoreRow {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
  game?: { id: string; title: string }; // solo presente en la vista global
}
```

Las funciones de consulta (`lib/supabase/games.ts`, `lib/supabase/scores.ts`) se definen durante la implementación, no en este spec.

**Recordar el nombre del jugador** (fuera de Supabase, en el cliente):

- `localStorage` key propia: `av_last_player_name` (independiente de `av_user` de `AuthContext`).
- Valor inicial del input "TUS INICIALES": `localStorage.getItem("av_last_player_name") ?? user ?? "INVITADO"`.
- Al guardar el puntaje: `localStorage.setItem("av_last_player_name", name)`.

**Estrategia de fetch** (decisión, no nueva estructura): `/juego/[id]` sigue siendo Server Component y usa `lib/supabase/server.ts` (igual patrón que hoy, solo cambia la fuente de datos). Home, Biblioteca y `/salon` ya son Client Components — hacen fetch con `lib/supabase/client.ts` dentro de un `useEffect`, sin reestructurarlos en server+client split.

## Implementation plan

1. Migración en Supabase (`mcp__supabase__apply_migration`): crear tablas `games` y `scores` según el Data model (sin RLS, con los índices), otorgar grants simples a `anon`/`authenticated` (SELECT en ambas, INSERT en `scores`), y sembrar la fila única de `asteroides` en `games`. Verificar con `list_tables`/`execute_sql` que la tabla y la fila existen.
2. Crear `lib/supabase/types.ts` con los tipos `Game` y `ScoreRow` (Data model). Crear `lib/supabase/games.ts` y `lib/supabase/scores.ts` con las funciones de consulta necesarias (nombres y firmas definidos durante la implementación). No se toca ninguna página todavía — el build sigue funcionando exactamente igual que hoy.
3. Migrar Home (`/`) y Biblioteca (`/juego`) para leer el catálogo (fetch client-side con `lib/supabase/client.ts` en un `useEffect`) en vez de importar `GAMES`. El catálogo visible pasa a mostrar solo la card de Asteroides.
4. Migrar Detalle (`/juego/[id]`) para leer el juego y su leaderboard vía `lib/supabase/server.ts` (sigue siendo Server Component); `notFound()` si el id no existe en `games`. El sidebar "MEJORES PUNTUACIONES" muestra el top 10 real, con el estado vacío si no hay scores. `/juego/rocas` y el resto de los decorativos empiezan a devolver 404 desde este paso.
5. Conectar `app/juego/asteroides/jugar/page.tsx`: "GUARDAR PUNTUACIÓN" hace un INSERT real en `scores` en vez de solo `setSaved(true)`; el input "TUS INICIALES" se precarga desde `localStorage["av_last_player_name"]` (o `user`, o `"INVITADO"`) y se actualiza esa key al guardar.
6. Reescribir `/salon` (Hall of Fame): tabs dinámicos por cada fila de `games` (hoy solo Asteroides), vista global y vista por juego, ambas top 10 con el mismo estado vacío. Se elimina el import de `seededScores`.
7. Eliminar `app/data/games.ts` y `app/data/scores.ts` (a esta altura ya nada los importa). Confirmar con un grep que no quedan referencias a `GAMES` ni `seededScores` en el proyecto.
8. Verificación final: correr `mcp__supabase__get_advisors` y confirmar que la única alerta esperada es la de RLS deshabilitado (aceptada explícitamente, ver Scope). Correr `tsc --noEmit` y `npm run build` sin errores. Probar manualmente en el navegador: catálogo con una sola card, `/juego/rocas` en 404, guardar un puntaje real en Asteroides, verlo aparecer en el sidebar de Detalle y en ambas vistas de `/salon`, el nombre recordado precargando el input en una segunda partida, y el estado vacío mostrándose correctamente antes del primer guardado.

## Acceptance criteria

- [ ] Las tablas `games` y `scores` existen en Supabase con el esquema definido en Data model, sin RLS habilitado, con grants de `SELECT` en ambas y `INSERT` en `scores` para los roles `anon`/`authenticated`.
- [ ] `games` contiene exactamente una fila (`id: "asteroides"`) con los datos ya definidos en SPEC 05; no tiene columnas `best`, `plays` ni `playable`.
- [ ] `lib/supabase/types.ts` exporta los tipos `Game` y `ScoreRow`.
- [ ] `app/data/games.ts` y `app/data/scores.ts` ya no existen; no queda ninguna referencia a `GAMES` ni `seededScores` en el proyecto.
- [ ] Home (`/`) y Biblioteca (`/juego`) muestran el catálogo leído desde Supabase: una sola card, Asteroides.
- [ ] `/juego/asteroides` (Detalle) carga sin errores, con los datos reales de `games` y el top 10 real de `scores` en el sidebar "MEJORES PUNTUACIONES".
- [ ] `/juego/rocas`, `/juego/bloque-buster` y el resto de los 6 juegos decorativos devuelven 404 (`notFound()`), tanto en Detalle como en Reproductor.
- [ ] En `/juego/asteroides/jugar`, "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (`game_id: "asteroides"`, `player_name`, `score`, `user_id: null`), verificable consultando la tabla después de guardar.
- [ ] El input "TUS INICIALES" se precarga con el último nombre usado (`localStorage["av_last_player_name"]`) en partidas subsiguientes, sin tener que re-escribirlo.
- [ ] `/salon` muestra dos vistas: **global** (top 10 de `scores` de todos los juegos existentes en `games`, indicando a qué juego pertenece cada fila) y **por juego** (un tab por fila de `games`, hoy solo Asteroides), ambas top 10.
- [ ] Guardar un puntaje nuevo en Asteroides y volver a `/salon` (recargando la página) refleja ese puntaje en ambas vistas, global y por juego.
- [ ] Cuando no hay scores para un juego, las tres vistas de leaderboard (sidebar de Detalle, Salón global, Salón por juego) muestran el mensaje "SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA" en vez de una tabla vacía o un error.
- [ ] `best` y `plays` mostrados en catálogo/Detalle reflejan valores calculados desde `scores` en tiempo real (no hardcodeados) y cambian después de guardar un puntaje nuevo.
- [ ] `mcp__supabase__get_advisors` no reporta ninguna alerta más allá de la esperada por RLS deshabilitado (aceptada explícitamente en este spec).
- [ ] El chequeo de tipos de TypeScript no reporta errores.
- [ ] `npm run build` (o `npm run dev`) termina sin errores de compilación.

## Decisions

- **Sí:** un solo spec combinado para `games` + `scores`, en vez de dividir en dos specs separados como se propuso al inicio. Decisión explícita del usuario.
- **Sí:** el leaderboard tiene dos vistas — global (mezcla todos los juegos) y por juego. Pedido explícito del usuario.
- **Sí:** la tabla `games` reemplaza por completo al array estático `GAMES`; no coexisten. Una sola fuente de verdad, sin riesgo de desincronización.
- **No:** columna `best` almacenada en `games`. Se calcula con `MAX(score)` en consulta — evita necesidad de trigger o sincronización.
- **No:** columna `plays` almacenada. Se calcula con `COUNT(*)` en consulta, igual que `best` — el stat "Partidas" en Detalle debe reflejar datos reales, no un valor congelado.
- **No:** trigger de actualización automática en `games`. Ya no aplica: al no haber columnas derivadas (`best`/`plays` se calculan en consulta), no hay nada que sincronizar.
- **No:** columna `playable` en `games`. Solo se siembra un juego real (Asteroides), así que "jugable" sería `true` en el 100% de las filas por construcción — no filtraría nada. Se reintroduce con una migración futura si algún día se siembra un juego no-jugable.
- **Sí:** `scores.user_id` nullable, siempre `NULL` en este spec. No hay Supabase Auth real todavía y no se quiere forzar login para jugar.
- **Sí:** `scores.player_name` es texto libre (lo que la persona escribe en "TUS INICIALES"), sin ligarlo a una identidad verificada. Consistente con el estado actual del proyecto.
- **Sí:** se siembra solo Asteroides en `games`; los 7 juegos decorativos no se migran a Supabase. Son contenido decorativo sin lógica real — migrarlos no aporta nada y agrega complejidad.
- **No:** preservar de alguna forma las rutas de los 7 juegos decorativos (fallback, redirect, mensaje especial). Es un efecto colateral aceptado de leer el catálogo solo desde Supabase, no una entrega de este spec.
- **No:** RLS (Row Level Security) en este spec. Acceso vía grants simples a `anon`/`authenticated`. Decisión explícita del usuario — RLS real queda para un spec futuro de seguridad dedicado.
- **No:** actualización en tiempo real (realtime/websockets) de los leaderboards. Decisión explícita del usuario — se cargan una vez al entrar a la pantalla.
- **No:** paginación en ningún leaderboard. Top 10 fijo y consistente en las tres vistas (sidebar de Detalle, Salón global, Salón por juego). Decisión explícita del usuario.
- **Sí:** mensaje de estado vacío "SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA" en las tres vistas de leaderboard cuando no hay scores. Mejor UX que una tabla vacía o un error. Pedido explícito del usuario.
- **Sí:** recordar el nombre del jugador en una key de `localStorage` propia (`av_last_player_name`), independiente de `AuthContext`/`av_user`. Permite precargar "TUS INICIALES" sin depender del sistema de login, que hoy es solo cosmético.
- **Sí:** guardado real de puntuación limitado a Asteroides en este spec; los otros 7 juegos siguen con `setSaved(true)` cosmético. Es el único juego con lógica real — conectar los decorativos no tendría sentido.
- **Sí:** los tipos `Game`/`ScoreRow` viven en `lib/supabase/types.ts`, separados de las funciones de consulta (`lib/supabase/games.ts`/`scores.ts`). Pedido explícito del usuario, separa tipos de lógica.
- **No:** especificar firmas exactas de las funciones de consulta en este spec. Pedido explícito del usuario — se definen durante la implementación.
- **Sí:** `/juego/[id]` sigue siendo Server Component (`lib/supabase/server.ts`); Home, Biblioteca y Salón siguen siendo Client Components y hacen fetch con `lib/supabase/client.ts` en un `useEffect`. Minimiza el cambio arquitectónico respecto al estado actual.
- **Sí:** `games.id` sigue siendo un slug de texto (ej. `"asteroides"`) como primary key, no un UUID. Continuidad con las rutas actuales que ya usan el id como segmento de URL.

## Identified risks

| Risk                                                                                                                                                                                                                    | Mitigation                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin RLS, cualquiera con la `anon` key (ya pública en el cliente) puede insertar filas ilimitadas en `scores` con cualquier `score`/`player_name`, sin límite de tasa.                                                   | Aceptado explícitamente como deuda técnica en este spec (ver Decisions/Out of scope); RLS real y validación anti-abuso quedan para el spec de seguridad futuro. El riesgo ya existe hoy en cualquier tabla de un proyecto Supabase sin RLS, con o sin este spec. |
| Home, Biblioteca y `/salon` pasan de leer un array estático en memoria a depender de una llamada de red al montar (fetch client-side). En conexión lenta o si Supabase no responde, la pantalla puede quedar en blanco. | Cada pantalla maneja un estado de carga mínimo explícito (y el estado vacío ya definido para los leaderboards); no se deja una pantalla en blanco silenciosa sin feedback.                                                                                       |
| `best`/`plays` se recalculan en cada consulta (`MAX`/`COUNT` sobre `scores`) sin caché. Con una sola fila en `games` hoy el costo es despreciable, pero no escala gratis si el catálogo crece en specs futuras.         | Aceptable para el volumen actual (1 juego real). Si se agregan más juegos reales, evaluar una vista materializada o columna cacheada en esa spec futura — no se resuelve preventivamente acá.                                                                    |

## What is **not** in this spec

- Autenticación real con Supabase Auth (`user_id` queda `NULL`).
- Migrar o mantener accesibles los 7 juegos decorativos.
- RLS (Row Level Security) en `games`/`scores`.
- Actualización en tiempo real (realtime) de los leaderboards.
- Paginación de cualquier leaderboard (top 10 fijo).
- UI de administración del catálogo de juegos.
- Validación anti-cheat de puntuaciones.
- Cualquier sistema real de "créditos".

Cada uno de estos, si se implementa, va en su propia spec.
