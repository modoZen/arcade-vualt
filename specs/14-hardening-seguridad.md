# SPEC 14 — Hardening de seguridad: RLS, contraseñas y headers HTTP

> **Status:** Aprobado
> **Depends on:** `specs/06-catalogo-y-leaderboard-supabase.md` (tablas `games`/`scores` que esta spec protege con RLS) y `specs/13-registro-login-autenticacion.md` (`scores.user_id` poblado por sesión real, y donde RLS quedó documentada explícitamente como deuda técnica sin resolver)
> **Date:** 2026-07-21
> **Objective:** Cerrar el checklist de seguridad básico (`references/security/checklist.md`) habilitando Row Level Security con políticas concretas en `public.games`/`public.scores` (lectura pública, inserción de scores restringida por identidad), agregando validación de complejidad de contraseña en el formulario de registro (cliente, sin llamar a Supabase si no pasa) junto con su configuración espejo en el dashboard de Supabase Auth, activando ahí mismo la protección de contraseñas filtradas y el límite de rate de signups, sumando protección de rutas en el proxy (`/auth/actualizar-password` y `/auth`), y agregando los tres headers de seguridad HTTP del checklist en `next.config.ts`.

## Scope

**In:**

- **Migración SQL (`mcp__supabase__apply_migration`) habilitando RLS** en `public.games` y `public.scores`, con estas políticas exactas:
  - `games`: `SELECT` pública para `anon` y `authenticated` (`USING (true)`). Sin política de `INSERT`/`UPDATE`/`DELETE` — los juegos se cargan solo vía migraciones con rol de servicio, que no pasa por RLS.
  - `scores`: `SELECT` pública para `anon` y `authenticated` (`USING (true)`) — el leaderboard se lee sin sesión. `INSERT` restringida por identidad: rol `anon` solo puede insertar filas con `user_id IS NULL`; rol `authenticated` solo puede insertar filas con `user_id = auth.uid()`. Sin política de `UPDATE`/`DELETE` — ningún rol puede editar ni borrar scores desde el cliente.
- **Validación de complejidad de contraseña en `app/auth/page.tsx`** (tab "Crear cuenta"): antes de llamar a `supabase.auth.signUp`, se valida en cliente que `signupPass` tenga mínimo 8 caracteres y al menos una minúscula, una mayúscula, un dígito y un símbolo. Si falla, se setea `signupError` con un mensaje claro (reutilizando el bloque de error ya existente) y **no se dispara el request** a Supabase.
- **Configuración espejo en el dashboard de Supabase Auth** (documentada como prerequisito manual, igual que las credenciales OAuth en SPEC 13):
  - Password Requirements: mínimo 8 caracteres + exigir minúsculas, mayúsculas, dígitos y símbolos.
  - Leaked Password Protection: activada (chequeo contra HaveIBeenPwned).
  - Rate Limits: confirmar/ajustar el límite de signups (protección anti-bot nativa de Supabase Auth).
- **Headers de seguridad HTTP en `next.config.ts`**: los 3 del checklist (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`) aplicados a todas las rutas (`source: "/(.*)"`).
- **Protección de rutas en el proxy** (`proxy.ts` + `lib/supabase/middleware.ts`, que hoy solo refresca la sesión), siguiendo el patrón oficial "Optimistic checks with Proxy" (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`):
  - `/auth/actualizar-password`: sin sesión activa, redirige a `/auth/recuperar` en vez de mostrar el formulario de nueva contraseña.
  - `/auth`: con sesión activa, redirige a `/` en vez de mostrar el formulario de login/registro.
  - El resto de las rutas (catálogo, detalle de juego, `jugar/*`, `/salon`, `/acerca-de`, `/auth/recuperar`, `/auth/callback`) siguen exactamente igual que hoy: públicas, sin exigir sesión.
- **Verificación con `mcp__supabase__get_advisors` (type: security)**: confirmar que los WARN/ERROR de RLS de `games`/`scores` desaparecen del reporte.

**Out of scope (para futuras specs):**

- **`public.rls_auto_enable()`** (función `SECURITY DEFINER` gestionada por la plataforma Supabase) — queda fuera: es infraestructura interna, no código del proyecto.
- **CAPTCHA real** (hCaptcha/Cloudflare Turnstile) en el formulario de registro — se usa el rate limit nativo de Supabase Auth, no un widget de captcha.
- **Headers adicionales** (`Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy`) — solo los 3 del checklist.
- **Borrado de scores propios por el usuario** (`UPDATE`/`DELETE` con `user_id = auth.uid()`) — no existe hoy esa funcionalidad en la UI, no se agrega política para algo que no se usa.
- **Indicador de fortaleza de contraseña en tiempo real** mientras se tipea — la validación de complejidad ocurre solo al enviar el formulario (submit), no hay feedback progresivo por carácter.
- **Protección de cualquier otra ruta** más allá de `/auth/actualizar-password` y `/auth` — el catálogo, los juegos y el salón de la fama permanecen públicos, sin exigir sesión (el modo invitado sigue siendo de primera clase).
- **Cambios en los motores de juego, skins, controles móviles o cualquier otra parte de la UI** fuera de `app/auth/page.tsx`, `app/auth/actualizar-password/page.tsx` (indirectamente, vía redirect) y el proxy.

## Data model

Este spec **no agrega tablas ni columnas nuevas** — reutiliza `public.games`, `public.scores` y `auth.users` tal como están. Lo que cambia son policies de RLS (estructuras de base de datos) y funciones/lógica de validación en código:

- **Migración `enable_rls_games_and_scores`** (vía `mcp__supabase__apply_migration`, revierte lo hecho por la migración previa `disable_rls_games_and_scores`):

  ```sql
  ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "games_public_read" ON public.games
    FOR SELECT TO anon, authenticated USING (true);

  CREATE POLICY "scores_public_read" ON public.scores
    FOR SELECT TO anon, authenticated USING (true);

  CREATE POLICY "scores_guest_insert" ON public.scores
    FOR INSERT TO anon WITH CHECK (user_id IS NULL);

  CREATE POLICY "scores_own_insert" ON public.scores
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  ```

  Sin policies de `UPDATE`/`DELETE` en ninguna tabla, ni de `INSERT`/`UPDATE`/`DELETE` en `games` — quedan bloqueadas por default al no tener policy.

- **`passwordError(pw: string): string | null`** — función nueva en `app/auth/page.tsx`, sin exportar. Devuelve el primer mensaje de error encontrado o `null` si la contraseña pasa las 5 reglas (longitud ≥ 8, minúscula, mayúscula, dígito, símbolo). Se llama al inicio de `submitSignup`, antes de tocar `signupPass !== signupConfirm`; si devuelve algo distinto de `null`, se setea en `signupError` y se corta el submit sin llamar a `supabase.auth.signUp`.

- **`updateSession` en `lib/supabase/middleware.ts`**: dentro de la función, después de `await supabase.auth.getUser()`, se lee `request.nextUrl.pathname` y se aplica:
  - `pathname === "/auth/actualizar-password"` y no hay usuario → `return NextResponse.redirect(new URL("/auth/recuperar", request.url))`.
  - `pathname === "/auth"` y hay usuario → `return NextResponse.redirect(new URL("/", request.url))`.
  - Cualquier otro `pathname` → comportamiento actual sin cambios (se sigue devolviendo el `response` con el refresco de cookies).

No cambian: `Game`, `ScoreRow`, `CATS` (`lib/supabase/types.ts`), `insertScore`, `UserContextValue`, ni la firma de `proxy()`/`config.matcher` en `proxy.ts`.

## Implementation plan

Cada paso deja el proyecto compilando (`npm run build`) y navegable; se verifica en el navegador antes de avanzar. Orden de menor a mayor riesgo.

1. **Headers de seguridad en `next.config.ts`**:
   - Agregar el array `securityHeaders` (los 3 del checklist) y la función `headers()` aplicándolos a `source: "/(.*)"`.
   - Verificación: `npm run build`; en el navegador (o `curl -I`), confirmar que `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` aparecen en la respuesta de `/`.

2. **Validación de complejidad de contraseña en `app/auth/page.tsx`**:
   - Agregar `passwordError(pw: string): string | null` y llamarla al inicio de `submitSignup`, antes de la comparación `signupPass !== signupConfirm`.
   - Verificación manual: intentar crear cuenta con `"abc"`, con `"password"` (sin mayúscula/dígito/símbolo) y con `"Abcd123!"` (válida) — las dos primeras deben mostrar error sin generar ningún request de red a Supabase (confirmable en la pestaña Network); la tercera debe seguir el flujo normal de signup.

3. **Protección de rutas en el proxy** (`lib/supabase/middleware.ts`), siguiendo el patrón oficial de "Optimistic checks with Proxy" (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`):
   - Dentro de `updateSession`, después de `await supabase.auth.getUser()`, leer `request.nextUrl.pathname` y aplicar:
     - si `pathname === "/auth/actualizar-password"` y no hay usuario → `return NextResponse.redirect(new URL("/auth/recuperar", request.url))`.
     - si `pathname === "/auth"` y hay usuario → `return NextResponse.redirect(new URL("/", request.url))`.
     - en cualquier otro caso → se sigue devolviendo el `response` actual (solo refresco de cookies), sin tocar `proxy.ts` ni su `config.matcher`.
   - Verificación manual: sin sesión, entrar directo a `/auth/actualizar-password` → redirige a `/auth/recuperar`; logueado, entrar a `/auth` → redirige a `/`; el resto de las rutas navega igual que antes.

4. **RLS en `games`/`scores`** (el paso de mayor riesgo — puede romper el guardado de scores o el leaderboard si alguna policy queda mal):
   - Aplicar la migración `enable_rls_games_and_scores` con las 4 policies del Data model vía `mcp__supabase__apply_migration`.
   - Verificación inmediata con `mcp__supabase__get_advisors` (type: security): los 2 ERROR de `rls_disabled_in_public` para `games`/`scores` ya no aparecen.
   - Verificación en navegador: el catálogo (`/juego`) y el Salón de la Fama (`/salon`) siguen leyendo scores sin sesión; jugar como invitado y guardar un score funciona igual que antes (`user_id: null`); loguearse, jugar y guardar un score funciona y queda con el `user_id` real (confirmable por SQL: `select * from scores order by id desc limit 1`).
   - Verificación de la restricción: intentar (vía `mcp__supabase__execute_sql` simulando el rol `anon`, o con el cliente browser manipulado) insertar un score como `anon` con un `user_id` no nulo, o como `authenticated` con el `user_id` de otro usuario — ambos deben fallar por la policy.

5. **Prerequisitos manuales en Supabase Dashboard** (no es código, se documenta como paso previo/paralelo, igual que en SPEC 13):
   - Authentication → Password Requirements: mínimo 8 caracteres + exigir minúsculas, mayúsculas, dígitos y símbolos (mismas reglas que `passwordError` en cliente, para que no haya desfasaje entre lo que la UI permite y lo que el backend acepta).
   - Authentication → Leaked Password Protection: activar.
   - Authentication → Rate Limits: confirmar/ajustar el límite de signups.

6. **Verificación final**:
   - `mcp__supabase__get_advisors` (type: security): confirmar que solo queda el WARN de `auth_leaked_password_protection` si el paso 5 no se aplicó todavía en el dashboard (o que desaparece si ya se aplicó), y que `rls_auto_enable` sigue como WARN documentado y fuera de alcance.
   - `npm run lint` y `npm run build` sin errores.
   - Smoke test en navegador (Playwright) de: registro con password débil (bloqueado en cliente) y fuerte (pasa), guardado de score como invitado y como usuario logueado, redirects del proxy en `/auth` y `/auth/actualizar-password`, y presencia de los 3 headers. Capturas en `.playwright-screenshots/`.

## Acceptance criteria

- [ ] Los 3 headers de seguridad (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`) están presentes en la respuesta HTTP de cualquier ruta de la app.
- [ ] Intentar crear una cuenta con una contraseña que no cumple las 5 reglas (≥8 caracteres, minúscula, mayúscula, dígito, símbolo) muestra un error claro en `app/auth/page.tsx` y **no** dispara ningún request a `supabase.auth.signUp` (verificable en la pestaña Network del navegador).
- [ ] Crear una cuenta con una contraseña que cumple las 5 reglas sigue el flujo normal de signup sin cambios.
- [ ] Sin sesión activa, navegar a `/auth/actualizar-password` redirige a `/auth/recuperar`.
- [ ] Con sesión activa, navegar a `/auth` redirige a `/`.
- [ ] El resto de las rutas (`/juego`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon`, `/acerca-de`, `/auth/recuperar`, `/auth/callback`) siguen siendo accesibles exactamente igual que antes, con o sin sesión.
- [ ] `public.games` y `public.scores` tienen RLS habilitado (`mcp__supabase__get_advisors` type security ya no reporta los ERROR `rls_disabled_in_public` para ninguna de las dos tablas).
- [ ] El catálogo (`/juego`) y el Salón de la Fama (`/salon`) siguen leyendo scores y juegos sin sesión (policy de `SELECT` pública funcionando).
- [ ] Jugar como invitado y guardar un score sigue funcionando igual que hoy (`user_id: null` insertado correctamente vía policy `scores_guest_insert`).
- [ ] Jugar logueado y guardar un score sigue funcionando igual que hoy, con `scores.user_id` poblado con el id real del usuario (policy `scores_own_insert`).
- [ ] Intentar insertar (fuera de la UI normal, p. ej. vía API/SQL simulando el rol) un score como `anon` con `user_id` no nulo, o como `authenticated` con el `user_id` de otro usuario, falla por RLS.
- [ ] No existe ninguna policy de `UPDATE`/`DELETE` en `scores`, ni de `INSERT`/`UPDATE`/`DELETE` en `games` — confirmable en el SQL de la migración aplicada.
- [ ] Prerequisitos manuales aplicados en el dashboard de Supabase Auth: Password Requirements (mínimo 8 + minúsculas/mayúsculas/dígitos/símbolos), Leaked Password Protection activada, y Rate Limit de signups confirmado/ajustado (documentados como pasos manuales completados, no verificables por código).
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Ninguna de las 5 props de los componentes de juego, ni `AuthContext`/`UserContext`, ni los motores de juego (`components/games/*.tsx`) cambian — cero impacto fuera de lo declarado en el Scope.

## Decisions taken and discarded

- **Sí: RLS con policies explícitas de `SELECT` pública + `INSERT` restringida por identidad**, en vez de dejar `games`/`scores` sin RLS (estado actual) o bloquear todo el acceso. Cierra el ERROR crítico de los advisors sin romper el modo invitado ni los leaderboards públicos. Decisión explícita del usuario.
- **Sí: `scores_guest_insert` (`user_id IS NULL`) y `scores_own_insert` (`user_id = auth.uid()`) como dos policies separadas**, en vez de una única policy abierta. Evita que un usuario logueado falsifique un score como invitado con `user_id` de otra persona, o que alguien inserte un score adjudicado a un `user_id` ajeno — valor de seguridad real sobre simplemente "formalizar lo que ya pasaba". Decisión explícita del usuario (eligió la opción recomendada sobre la política abierta).
- **Sí: sin policies de `UPDATE`/`DELETE` en `scores`, ni de escritura en `games`.** Ninguna funcionalidad de la UI las necesita hoy — `games` se carga por migración con rol de servicio, y la app nunca edita/borra un score. Agregar policies para operaciones que no existen sería exponer superficie sin necesidad. Decisión explícita del usuario.
- **Sí: validación de complejidad de contraseña en cliente, espejada en el dashboard de Supabase Auth.** El cliente evita el request innecesario y da feedback inmediato; la config del dashboard es la que realmente aplica la regla (el cliente se puede saltear llamando a la API directo), así que ambas capas son necesarias, no redundantes. Decisión explícita del usuario.
- **Sí: solo validación al submit, sin indicador de fortaleza en tiempo real.** Cierra el requisito ("mostrar un error y no mandar autenticar una contraseña que no pasará") con el mínimo de UI nueva; un medidor progresivo es una mejora de UX distinta, no un requisito de seguridad. Decisión explícita del usuario (no se pidió explícitamente el indicador en tiempo real).
- **Sí: rate limit nativo de Supabase Auth para el anti-bot de signups**, no CAPTCHA. Es lo que el checklist describe literalmente ("limitar signups por IP"), es config de dashboard sin código nuevo, y evita la complejidad de integrar un proveedor de CAPTCHA (env vars, widget, validación server-side) que el checklist no pedía explícitamente. Decisión explícita del usuario.
- **Sí: protección de rutas en el proxy siguiendo el patrón oficial "Optimistic checks with Proxy"** (`node_modules/next/dist/docs`), limitada a `/auth/actualizar-password` (sin sesión → `/auth/recuperar`) y `/auth` (con sesión → `/`). Es el único gap de UX/seguridad real detectado (cualquiera podía entrar directo al formulario de nueva contraseña sin haber pasado por el flujo de reset). El resto del catálogo permanece público a propósito. Decisión explícita del usuario.
- **No: revocar `EXECUTE` sobre `public.rls_auto_enable()`.** Es una función interna de la plataforma Supabase (gestiona el auto-enable de RLS en tablas nuevas), no código del proyecto; tocarla podría interferir con ese mecanismo. Queda documentada como hallazgo fuera de alcance. Decisión explícita del usuario.
- **No: CAPTCHA (hCaptcha/Turnstile) en el registro.** Ver decisión de rate limit nativo arriba — se descartó explícitamente a favor de la opción sin código nuevo.
- **No: headers adicionales** (`Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy`). Se ciñe estrictamente a los 3 del checklist para evitar el riesgo de romper Supabase/fonts/scripts sin una auditoría dedicada de orígenes. Decisión explícita del usuario.
- **No: policy de borrado de scores propios.** No hay funcionalidad de la UI que la necesite; agregarla sería alcance especulativo. Decisión explícita del usuario.

## Identified risks

| Risk                                                                                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Habilitar RLS sin la policy de `INSERT` correcta rompe el guardado de scores para invitados o para usuarios logueados (pantalla de fin de partida fallando silenciosamente o con error de Supabase).                                       | Paso 4 aislado del resto del plan, con verificación explícita en navegador de ambos flujos (invitado y logueado) antes de pasar al paso 5; se prueba también el caso negativo (insert con `user_id` ajeno debe fallar).                                                                      |
| El redirect de `/auth` con sesión activa podría interferir con `app/auth/callback/route.ts` si por error el matcher del proxy alcanzara esa ruta (dejando a un usuario recién logueado sin completar el intercambio de `code` por sesión). | El check de pathname es exacto (`=== "/auth"`), no un `startsWith`, así que no alcanza a `/auth/callback`, `/auth/recuperar` ni `/auth/actualizar-password`. Se verifica explícitamente el flujo de login/OAuth de punta a punta en el paso 6.                                               |
| Desfasaje entre la regla de complejidad de contraseña del cliente (`passwordError`) y la configurada en el dashboard de Supabase Auth, dejando pasar en cliente una contraseña que el backend rechaza (o viceversa).                       | Paso 5 documenta las mismas 5 reglas exactas a configurar en el dashboard; se verifica en el paso 6 registrando con una contraseña que cumple ambas.                                                                                                                                         |
| El límite de rate de signups configurado en el dashboard podría bloquear las propias pruebas manuales del paso 6 si se registran muchas cuentas de prueba seguidas.                                                                        | Se documenta el límite elegido en el paso 5; si bloquea las pruebas, se usan emails de prueba espaciados en el tiempo, no se baja el límite solo para testear.                                                                                                                               |
| Migrar `updateSession` para que a veces devuelva un `NextResponse.redirect(...)` en vez de siempre `NextResponse.next(...)` podría romper el refresco de cookies de sesión si el redirect no las propaga correctamente.                    | Los redirects ocurren solo en los 2 casos nuevos (rutas específicas); el resto de las rutas sigue devolviendo el `response` con cookies ya seteadas, sin cambios. Se verifica que la persistencia de sesión tras recargar (ya cubierta en SPEC 13) sigue funcionando después de este cambio. |
