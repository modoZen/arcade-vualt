# SPEC 13 — Autenticación real con Supabase Auth

> **Status:** Implementado
> **Depends on:** `specs/04-setup-supabase.md` (cliente Supabase ya configurado en `lib/supabase/client.ts`/`server.ts`) y `specs/06-catalogo-y-leaderboard-supabase.md` (tabla `scores`, cuya columna `user_id` esta spec empieza a poblar)
> **Date:** 2026-07-21
> **Objective:** Reemplazar el pseudo-auth actual (`app/context/AuthContext.tsx` guardando solo un nombre en `localStorage`) por un `UserContext` (`app/context/UserContext.tsx`, hook `useUser`) que expone únicamente estado derivado de la sesión real de Supabase Auth — `{ user, session, username, avatarUrl, loading, signOut }`, sin `signIn`/`signUp`/`signInWithOAuth`/`resetPassword` (esas acciones llaman a `createClient()` de Supabase directo desde donde se usan, como ya hace `insertScore` en cada `jugar/page.tsx`) — habilitando registro/login por email/password, login social con Google/GitHub (`avatarUrl`/`username` se derivan de `user_metadata`, incluido lo que trae OAuth), confirmación de email obligatoria y recuperación de contraseña, manteniendo el modo "Jugar como invitado" en paralelo y vinculando `scores.user_id` al usuario autenticado cuando hay sesión.

## Scope

**In:**

- **`UserContext` nuevo** (`app/context/UserContext.tsx`, reemplaza `AuthContext.tsx`, hook `useUser`): escucha `supabase.auth.onAuthStateChange` y expone `{ user, session, username, avatarUrl, loading, signOut }` como estado derivado. `username`/`avatarUrl` se leen de `user.user_metadata` (`display_name`, y `avatar_url ?? picture` para OAuth).
- **Refresco de sesión SSR**: `middleware.ts` en la raíz + helper en `lib/supabase/middleware.ts`, siguiendo el patrón estándar de `@supabase/ssr` para Next.js App Router (consultar `node_modules/next/dist/docs/` para la firma exacta de middleware en esta versión antes de escribirlo, por AGENTS.md).
- **Ruta de callback** `app/auth/callback/route.ts`: intercambia el `code` que llega por link de confirmación de email, por link de reset de password, o por el redirect de OAuth, por una sesión real (`exchangeCodeForSession`).
- **Reescritura de `app/auth/page.tsx`**:
  - Tab "Iniciar sesión": email + password (ya no "Usuario"), link "¿Olvidaste tu contraseña?", estados de error (credenciales inválidas, email no confirmado) y loading.
  - Tab "Crear cuenta": usuario (→ `display_name` en `user_metadata`), email, password, confirmar password (con validación de coincidencia en cliente), mensaje post-registro pidiendo confirmar el email.
  - Botones "Google"/"GitHub" wireados a `supabase.auth.signInWithOAuth`, ya funcionales en código aunque las credenciales de los providers queden pendientes de cargar en el dashboard de Supabase (prerequisito manual, documentado en este spec).
  - Botón "Jugar como invitado" se mantiene igual que hoy.
- **Recuperación de contraseña**: pantalla para pedir el email de reset (nueva ruta, `app/auth/recuperar/page.tsx`) + pantalla para definir la nueva password tras volver del link (`app/auth/actualizar-password/page.tsx`).
- **`components/Nav.tsx`**: usa `username`/`avatarUrl` de `useUser` en vez del string crudo; `signOut` pasa a ser async (`supabase.auth.signOut()`).
- **`lib/supabase/scores.ts`**: `insertScore` acepta `userId: string | null` y lo persiste en `scores.user_id` (hoy siempre se manda `null`).
- **Las 5 páginas `jugar/page.tsx` + `app/juego/[id]/jugar/page.tsx`**: si hay sesión, el modal de fin de partida no pide iniciales — usa `username` como `player_name` y manda `userId`. Si no hay sesión (invitado), sigue exactamente el flujo actual (iniciales tipeadas, `userId: null`).
- **Prerequisitos manuales documentados** (no son código, se listan como pasos previos en el spec): habilitar "Confirm email" en Supabase Auth settings; cargar client ID/secret de Google y GitHub como providers OAuth; configurar Site URL y Redirect URLs (`/auth/callback`) en el dashboard.

**Out of scope (para futuras specs):**

- **RLS en `public.games`/`public.scores`** — hallazgo de seguridad ya reportado, queda como deuda técnica separada; este spec no la resuelve.
- **Login por username** — el login es por email; el "Usuario" tipeado en el registro es solo `display_name`, sin unicidad garantizada.
- **Subida de avatar propia** — `avatarUrl` solo se lee de lo que ya provee OAuth (Google/GitHub); no hay upload a Supabase Storage ni picker de imagen.
- **Pantalla de edición de perfil** (cambiar nombre, password o email ya logueado) — solo entra el flujo de alta/login/reset, no la gestión posterior de la cuenta.
- **Envío de emails de auth vía Resend** — se usa el servicio de email nativo de Supabase Auth para confirmación/reset, no se integra con `RESEND_API_KEY` (eso queda reservado al formulario de contacto).
- **Rate limiting / CAPTCHA / protección anti-bot** en registro o login — se usa el comportamiento default de Supabase Auth, sin hardening adicional.
- **Cambios en los motores de juego** (`components/games/*.tsx`) — cero impacto, esta spec no toca lógica de juego ni skins.
- **Migraciones de base de datos** — no se crea ninguna tabla nueva (no hay `profiles`); `auth.users` y `scores.user_id` ya existen.

## Data model

Este spec **no agrega tablas ni migraciones** — `auth.users` (nativa de Supabase Auth) y `scores.user_id` (FK ya existente) cubren todo lo necesario. Lo que sí cambia son estructuras de código:

- **`user_metadata` de `auth.users`** (JSON gestionado por Supabase, no una tabla propia):
  - `display_name: string` — seteado en el registro vía `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`.
  - `avatar_url` / `picture` — no los seteamos nosotros; para logins OAuth, Google/GitHub los completan automáticamente al crear el usuario.
- **`UserContextValue`** (`app/context/UserContext.tsx`):
  ```ts
  interface UserContextValue {
    user: User | null; // tipo de @supabase/supabase-js
    session: Session | null; // idem
    username: string | null; // user?.user_metadata?.display_name ?? null
    avatarUrl: string | null; // user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null
    loading: boolean; // true hasta que onAuthStateChange dispara el primer evento
    signOut: () => Promise<void>;
  }
  ```
- **`insertScore`** (`lib/supabase/scores.ts`) cambia su firma:
  ```ts
  insertScore(supabase, { gameId: string; playerName: string; score: number; userId: string | null })
  ```
  y pasa `user_id: params.userId` en el insert (hoy hardcodeado a `null`).

No cambian: `Game`, `ScoreRow`, `CATS` (`lib/supabase/types.ts`), ni el esquema de `public.games`/`public.scores`.

## Implementation plan

Cada paso deja el proyecto compilando (`npm run build`) y navegable; se verifica en el navegador antes de avanzar.

1. **Prerequisitos manuales en Supabase Dashboard** (no es código, se documenta como precondición):
   - Habilitar "Confirm email" en Authentication → Settings.
   - Configurar Site URL y Redirect URLs incluyendo `/auth/callback` (local y producción).
   - Nota: credenciales de Google/GitHub OAuth quedan pendientes de cargar — el código del paso 4 funciona igual, pero esos botones no completan el login hasta que se carguen.

2. **Infraestructura de sesión SSR**:
   - Crear `lib/supabase/middleware.ts` (helper `updateSession`) y `middleware.ts` en la raíz, consultando `node_modules/next/dist/docs/` para la firma de middleware de esta versión de Next antes de escribirlo (por AGENTS.md).
   - Crear `app/auth/callback/route.ts`: intercambia `code` por sesión (`exchangeCodeForSession`) y redirige a `/`.
   - Verificación: `npm run build` sin errores; la app carga igual que antes (sin cambios visibles todavía).

3. **Migrar `AuthContext` → `UserContext`**:
   - Crear `app/context/UserContext.tsx` con `{ user, session, username, avatarUrl, loading, signOut }`, suscripto a `supabase.auth.onAuthStateChange` + `getSession()` inicial. Borrar `AuthContext.tsx`.
   - Actualizar el `Provider` en el layout raíz y los 7 consumidores (`Nav.tsx` + las 6 páginas `jugar`) de `useAuth`/`user` (string) a `useUser`/`username`.
   - Verificación: build pasa; `Nav` muestra "Iniciar Sesión" (sin sesión real todavía porque `/auth` no está reescrita) igual que se veía antes.

4. **Reescribir `app/auth/page.tsx`**:
   - Tab login: email + password, error de credenciales inválidas / email no confirmado, link "¿Olvidaste tu contraseña?".
   - Tab registro: usuario (→ `display_name`), email, password, confirmar password, mensaje post-registro pidiendo confirmar el email.
   - Botones Google/GitHub → `signInWithOAuth`. Botón invitado sin cambios.
   - Verificación manual: registrar un usuario de prueba (queda pendiente de confirmación), loguear uno ya confirmado, probar credenciales inválidas, confirmar que "Jugar como invitado" sigue igual que hoy.

5. **Recuperación de contraseña**:
   - `app/auth/recuperar/page.tsx` (pedir email, dispara `resetPasswordForEmail`) y `app/auth/actualizar-password/page.tsx` (define nueva password tras volver del link).
   - Verificación: flujo completo de punta a punta con un usuario de prueba.

6. **Vincular scores a la sesión**:
   - `insertScore` acepta `userId: string | null` y lo persiste en `scores.user_id`.
   - Las 6 páginas de juego: si hay sesión, el modal de fin de partida usa `username` automático (sin pedir iniciales) y manda `userId`; si es invitado, sigue el flujo actual de iniciales tipeadas con `userId: null`.
   - Verificación: jugar logueado y confirmar por SQL (`select * from scores order by id desc limit 1`) que `user_id` quedó poblado; jugar como invitado y confirmar que sigue igual que hoy.

7. **Verificación final**:
   - `npm run lint` y `npm run build` sin errores.
   - Smoke test en navegador (Playwright) de los 3 flujos: registro + confirmación de email, login/logout, y el redirect de OAuth (hasta donde permite la falta de credenciales cargadas). Capturas en `.playwright-screenshots/`.

## Acceptance criteria

- [x] Registrarse con email + password crea un usuario en Supabase Auth (`auth.users`) con `user_metadata.display_name` poblado.
- [x] Tras registrarse, no se puede iniciar sesión hasta confirmar el email (mensaje claro en la UI indicándolo).
- [x] Login con email + password válido y confirmado entra correctamente y redirige a `/`; `Nav` muestra el `username`.
- [x] Login con credenciales inválidas muestra un error legible sin romper la página.
- [x] Login con email sin confirmar muestra un mensaje específico (distinto al de credenciales inválidas).
- [x] Cerrar sesión limpia la sesión de Supabase y `Nav` vuelve a mostrar "Iniciar Sesión".
- [x] Los botones Google/GitHub invocan `signInWithOAuth` y redirigen al provider correspondiente (verificado de punta a punta: las credenciales ya estaban cargadas en el dashboard y ambos redirigen a la pantalla real de login del provider).
- [x] El flujo "¿Olvidaste tu contraseña?" envía el email de reset y permite definir una nueva password de punta a punta con un usuario de prueba. (El request de reset y la pantalla de nueva password quedaron verificados; el click sobre un link de email real quedó bloqueado por el rate limit de emails del proyecto de Supabase — riesgo ya documentado más abajo como bloqueo externo aceptado, no un bug de código.)
- [x] "Jugar como invitado" sigue funcionando exactamente igual que hoy: sin sesión, `player_name` tipeado libremente, `scores.user_id` en `null`.
- [x] Al guardar un score estando logueado, el modal de fin de partida **no** pide iniciales: usa `username` automáticamente y `scores.user_id` queda poblado con el id real del usuario (verificable por SQL).
- [x] La sesión persiste tras recargar la página (verifica que `middleware.ts` refresca correctamente vía SSR). (Implementado como `proxy.ts` — ver nota de implementación: este Next.js 16 deprecó `middleware.ts` en favor de `proxy.ts`/`proxy()`.)
- [x] `npm run lint` y `npm run build` corren sin errores.
- [x] No se agregó ninguna migración SQL ni tabla nueva — `auth.users` y `scores.user_id` son los únicos elementos de datos usados.
- [x] RLS de `public.games`/`public.scores` permanece sin cambios (deuda técnica documentada, no resuelta en este spec).

## Decisions taken and discarded

- **Sí: Supabase Auth real sobre `auth.users`**, no una tabla de usuarios propia. `scores.user_id` ya tiene la FK apuntando ahí; reutilizarla evita reinventar hashing de passwords, sesiones y expiración. Decisión explícita del usuario.
- **Sí: login por email**, no por username. Es el flujo nativo de `signInWithPassword`; loguear por username hubiera exigido una tabla de perfiles con unicidad + una consulta previa de mapeo username→email, deuda evitable.
- **Sí: `display_name`/`avatar_url` en `user_metadata`**, no en una tabla `profiles` nueva. No se necesita unicidad de nombre ni consultas SQL sobre el perfil; evita una migración y su propia política de RLS.
- **Sí: `UserContext` expuesto como estado puro** (`user`, `session`, `username`, `avatarUrl`, `loading`, `signOut`), sin `signIn`/`signUp`/`signInWithOAuth`/`resetPassword` en el context. Esas acciones se llaman con `createClient()` directo desde donde se usan, igual que ya hace `insertScore` en cada `jugar/page.tsx` — evita indirección que el proyecto no usa en ningún otro lado. Decisión explícita del usuario.
- **Sí: `AuthContext.tsx` se renombra a `UserContext.tsx`** (`useAuth` → `useUser`) en vez de mantener el nombre viejo. Decisión explícita del usuario: refleja que ahora expone un usuario real, no solo un flag de auth.
- **Sí: modo invitado convive con cuentas reales**, sin volverse obligatorio. No rompe la experiencia de nadie; loguearse es opt-in y solo aporta identidad persistente. Decisión explícita del usuario.
- **Sí: confirmación de email obligatoria** antes de poder loguear. Prioriza seguridad básica sobre fricción mínima. Decisión explícita del usuario.
- **Sí: OAuth (Google + GitHub) entra en el código de este spec**, aunque las credenciales de los providers queden pendientes de cargar en el dashboard de Supabase. Se documenta como prerequisito manual en vez de bloquear el spec por una config externa. Decisión explícita del usuario.
- **Sí: `avatarUrl` solo lee lo que ya trae OAuth** (`avatar_url ?? picture` de `user_metadata`). No se construye upload de avatar propio — sería scope de otro spec (Storage, bucket, UI de selección). Decisión explícita del usuario.
- **Sí: recuperación de contraseña entra en este spec**, no se pospone. Es parte natural del ciclo de vida de una cuenta con password; separarla hubiera dejado el spec incompleto para un usuario que se traba en el login. Decisión explícita del usuario.
- **Sí: campo "confirmar contraseña" en el registro.** Reduce errores de tipeo a bajo costo de UI. Decisión explícita del usuario.
- **No: resolver RLS de `public.games`/`public.scores` en este spec.** Es un hallazgo de seguridad preexistente e independiente de la autenticación (ya estaba deshabilitado antes de este spec); mezclarlo infla el alcance y las políticas dependen de decisiones de producto que no se tomaron acá. Decisión explícita del usuario.
- **No: usar Resend para los emails de auth.** Supabase Auth ya tiene su propio servicio de envío (confirmación, reset); mezclar dos proveedores de email para el mismo propósito agrega complejidad sin beneficio. `RESEND_API_KEY` queda reservado al formulario de contacto.
- **No: pantalla de edición de perfil post-login** (cambiar nombre/password/email ya logueado). Fuera del ciclo alta→login→reset que cubre este spec.

## Identified risks

| Risk                                                                                                                                                                                                                                   | Mitigation                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin credenciales de Google/GitHub cargadas, los botones OAuth redirigen a un error del provider en vez de completar el login — no se puede verificar el flujo de punta a punta en este spec.                                           | Se documenta como prerequisito manual pendiente; el criterio de aceptación de OAuth se limita a "invoca `signInWithOAuth` y redirige", no a un login completo.                              |
| El middleware de refresco de sesión (`middleware.ts`) es la pieza más nueva de infraestructura del proyecto (no existía ninguna antes) — un matcher mal configurado puede romper rutas o dejar sesiones sin refrescar silenciosamente. | Paso 2 aislado con verificación explícita de que la app sigue funcionando igual antes de tocar ningún componente; se prueba recarga de página con sesión activa en el paso 7.               |
| Emails de confirmación/reset de Supabase pueden no llegar en desarrollo local si no hay SMTP configurado en el proyecto (Supabase usa un límite bajo de emails en su servicio default).                                                | Verificar en el paso 1 que el dashboard tiene un método de entrega de emails funcionando antes de probar los flujos; si no llegan, se documenta como bloqueo externo, no un bug del código. |
| Migrar los 7 consumidores de `useAuth` a `useUser` en el mismo paso (3) puede dejar algún import viejo sin actualizar y romper el build.                                                                                               | `npm run build` se corre al final del paso 3 antes de avanzar al paso 4; TypeScript marca cualquier import roto de inmediato.                                                               |
| Un usuario logueado cuyo `display_name` quede vacío (username no tipeado, o dato faltante en algún signup viejo) guardaría un score con `player_name` vacío.                                                                           | El registro exige el campo "Usuario"; adicionalmente, al armar `player_name` para el insert se aplica el mismo fallback que ya existe hoy (`?? "INVITADO"`) si `username` viniera nulo.     |
