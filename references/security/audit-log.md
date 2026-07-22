# Log de auditorías de seguridad — `security-auditor`

Log acumulativo de corridas del agente `security-auditor` contra el baseline de SPEC 13/14. Cada corrida agrega una sección nueva al final con fecha; el historial no se edita ni se reescribe a mano.

## Auditoría — 2026-07-21

### 🟢 1. RLS habilitado en `public.games` y `public.scores`

**Estado: cumple.**

- `get_advisors(type: "security")`: no aparece ningún `rls_disabled_in_public` para `games` ni `scores`.
- `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('games','scores')` → `games: relrowsecurity=true`, `scores: relrowsecurity=true`.

Sin hallazgos.

### 🟢 2. Policies de `games`/`scores` contra el baseline

**Estado: cumple, coincide exactamente con SPEC 14.**

| tabla    | policy                | cmd    | roles                  | qual / with_check                   |
| -------- | --------------------- | ------ | ---------------------- | ----------------------------------- |
| `games`  | `games_public_read`   | SELECT | `{anon,authenticated}` | `USING (true)`                      |
| `scores` | `scores_public_read`  | SELECT | `{anon,authenticated}` | `USING (true)`                      |
| `scores` | `scores_guest_insert` | INSERT | `{anon}`               | `WITH CHECK (user_id IS NULL)`      |
| `scores` | `scores_own_insert`   | INSERT | `{authenticated}`      | `WITH CHECK (user_id = auth.uid())` |

Solo 4 filas, exactamente las del baseline. No hay `UPDATE`/`DELETE` en `scores`, ni `INSERT`/`UPDATE`/`DELETE` en `games`. Sin hallazgos.

### 🟢 3. Complejidad de password en cliente

**Estado: cumple.** `app/auth/page.tsx:9-16` — `passwordError(pw)` aplica las 5 reglas (≥8 caracteres, minúscula, mayúscula, dígito, símbolo). Se llama en `submitSignup` (línea 70), antes de comparar `signupPass !== signupConfirm` (línea 76) y antes de `supabase.auth.signUp` (línea 83) — corta el submit sin request si falla. Sin hallazgos.

### 🟢 4. Los 3 headers de seguridad HTTP

**Estado: cumple.** `next.config.ts:3-27` — array `securityHeaders` con `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, aplicado en `headers()` con `source: "/(.*)"`. No había dev server corriendo para el chequeo en vivo opcional vía `curl` — no es un hallazgo, solo no se aplicó. Sin hallazgos.

### 🟢 5. Protección de rutas en el proxy

**Estado: cumple.** `lib/supabase/middleware.ts:37-45` — ambos redirects presentes con comparación `===` exacta (no `startsWith`, por lo que `/auth/callback` no queda atrapado):

- `pathname === "/auth/actualizar-password" && !user` → redirect a `/auth/recuperar`.
- `pathname === "/auth" && user` → redirect a `/`.

`proxy.ts:9-11` — `config.matcher` sigue sin excluir `/auth*`. Sin hallazgos.

### 🟢 6. Config de Supabase Auth vía advisors

**Estado: cumple, sin advisors nuevos.** `get_advisors(type: "security")` devuelve exactamente los 3 WARN ya documentados como deuda aceptada (ver abajo). Ningún ERROR de RLS, ningún advisor no listado en SPEC 14.

---

**Deuda ya aceptada (no son hallazgos nuevos, documentada en SPEC 14):**

- `auth_leaked_password_protection` (WARN) — Leaked Password Protection desactivada; feature de plan pago, decisión explícita del usuario.
- `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable` (WARN) — `public.rls_auto_enable()`, infraestructura interna de Supabase, fuera de alcance por decisión explícita.

**Veredicto: baseline íntegro, sin hallazgos nuevos.** No se requiere acción del usuario en esta corrida.
