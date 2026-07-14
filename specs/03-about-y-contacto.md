# SPEC 03 — Página About y envío de correo de contacto

> **Status:** Implementado
> **Depends on:** SPEC 01 (rutas base, Nav, `app/data/games.ts`), SPEC 02 (Home, Nav con Inicio/Biblioteca/Salón)
> **Date:** 2026-07-14
> **Objective:** Crear la pantalla "Acerca de" en `/acerca-de` (basada en `references/templates/home-about/about.jsx`) con un formulario de contacto que envía correos reales vía Resend a `maxdn.06@gmail.com`.

## Scope

**In:**

- Nueva pantalla About en `app/acerca-de/page.tsx` (ruta `/acerca-de`): hero/misión (kicker, título, texto de misión, highlight-row de 3 iconos), divisor decorativo, y sección de contacto (intro + tips + formulario) — tomado 1:1 de `references/templates/home-about/about.jsx`.
- Formulario de contacto (nombre, correo, mensaje) que al enviarse hace un POST real a un Route Handler que envía el correo vía Resend.
- Route Handler `app/api/contacto/route.ts` que recibe `{ name, email, msg }`, valida que no estén vacíos, envía el correo con Resend (`from: "Arcade Vault <onboarding@resend.dev>"`, `to: "maxdn.06@gmail.com"`, `reply_to: email del usuario`) y responde éxito o error.
- Estados del formulario: vacío → shake (igual al template), enviando (loading), éxito (animación terminal existente, ahora disparada por una respuesta real), y error (estado nuevo: mensaje estilo terminal, permite reintentar sin perder lo escrito).
- Portar a `app/globals.css` las clases CSS necesarias (`.about-hero`, `.highlight-row`, `.about-divider`, `.about-contact`, `.contact-form`, `.terminal-success`, etc.) desde `references/templates/home-about/styles.css`.
- Agregar la dependencia `resend` a `package.json`.
- Documentar la variable de entorno `RESEND_API_KEY` (en `.env.local`, ya ignorado por git vía `.env*` en `.gitignore`).
- Actualizar `components/Nav.tsx`: agregar link "Acerca de" → `/acerca-de` en el nav de escritorio y en el menú móvil, actualizar `isActive()`.

**Out of scope (para futuras specs):**

- Validación de formato de correo (regex) en el input — se mantiene igual al template, solo verifica que el campo no esté vacío.
- Protección anti-spam (honeypot u otra).
- Persistencia de los mensajes enviados (base de datos, logs, historial) — el mensaje solo se envía por correo, no se guarda en ningún lado.
- Verificación de dominio propio en Resend — se usa la dirección de pruebas `onboarding@resend.dev` como remitente.
- Rate limiting del endpoint `/api/contacto`.
- Cambios a Home, Biblioteca, Detalle, Reproductor, Auth o Salón.

## Data model

No se introduce ningún modelo de datos persistente.

- **Payload del formulario** — `{ name: string; email: string; msg: string }` — tipado inline en el componente y en el API Route. No se exporta ni se guarda.
- **Variable de entorno** — `RESEND_API_KEY` en `.env.local`. El API Route la lee con `process.env.RESEND_API_KEY`. Si está vacía o incorrecta, Resend lanzará un error que el Route captura y devuelve como `{ error: "…" }`.
- **Respuesta del API Route** — `{ ok: true }` en éxito, `{ error: string }` en fallo. El componente usa este campo para decidir qué estado mostrar.

## Implementation plan

1. Instalar la dependencia `resend` y documentar `RESEND_API_KEY` en `.env.local` (no versionado, ya cubierto por `.env*` en `.gitignore`).
2. **Crear `app/api/contacto/route.ts`** — Route Handler `POST` que:
   - Lee `{ name, email, msg }` del body JSON.
   - Valida que los tres campos no estén vacíos; si falta alguno, devuelve `400 { error: "..." }`.
   - Instancia `new Resend(process.env.RESEND_API_KEY)` y llama a `resend.emails.send(...)` con `to: "maxdn.06@gmail.com"`, `from: "Arcade Vault <onboarding@resend.dev>"`, `reply_to: email`, `subject` y `html` armados con los datos del formulario.
   - Devuelve `200 { ok: true }` en éxito o `500 { error: "..." }` si Resend falla.

   Verificación: `curl -X POST /api/contacto` con body válido retorna `{ ok: true }` (cuando la key esté configurada).

3. Portar a `app/globals.css` las clases CSS de About tomadas de `references/templates/home-about/styles.css` (`.about-hero`, `.highlight-row`, `.about-divider`, `.about-contact`, `.contact-form`, `.terminal-success`, etc.).
4. Crear `app/acerca-de/page.tsx` con la sección hero/misión (kicker, título, texto de misión, highlight-row de 3 iconos) y el divisor decorativo, tomados del template. La página ya es visitable y visualmente completa, sin formulario funcional todavía.
5. Agregar la sección de contacto a `app/acerca-de/page.tsx`: formulario (nombre, correo, mensaje) con estados `idle` / `sending` / `sent` / `error`. Al enviar, hace `fetch` a `POST /api/contacto`; mientras espera muestra `sending`, en éxito reutiliza la animación `terminal-success` existente, y en error muestra un bloque de error estilo terminal con botón para reintentar sin perder lo escrito.
6. Actualizar `components/Nav.tsx`: agregar el link "Acerca de" → `/acerca-de` en el nav de escritorio y en el menú móvil, y actualizar `isActive()` para reconocer la nueva ruta.

## Acceptance criteria

- [x] `/acerca-de` carga sin errores en consola y muestra la sección hero/misión con el texto y los 3 highlights del template.
- [x] El divisor decorativo y la sección de contacto (intro + tips + formulario) se muestran igual que en el template.
- [x] El link "Acerca de" aparece en el Nav de escritorio y en el menú móvil, y navega a `/acerca-de`.
- [x] El link "Acerca de" del Nav queda activo (resaltado) cuando la ruta actual es `/acerca-de`.
- [x] Si se intenta enviar el formulario con algún campo vacío, se dispara el efecto "shake" y no se hace ningún request.
- [x] `POST /api/contacto` con `{ name, email, msg }` válidos y `RESEND_API_KEY` configurada responde `200 { ok: true }` y el correo llega a `maxdn.06@gmail.com` con `reply_to` igual al correo del formulario.
- [x] `POST /api/contacto` con algún campo vacío responde `400 { error: "..." }`.
- [x] `POST /api/contacto` responde `500 { error: "..." }` si Resend falla (ej. `RESEND_API_KEY` inválida o ausente).
- [x] Mientras el formulario espera la respuesta del servidor, se muestra el estado `sending` (feedback visual de envío en curso).
- [x] En éxito, el formulario muestra la animación `terminal-success` con el nombre ingresado, igual que el template.
- [x] En error, el formulario muestra un bloque de error estilo terminal con un botón para reintentar, sin perder los datos escritos.
- [x] Después de un envío exitoso, el botón "ENVIAR OTRO MENSAJE" limpia el formulario y vuelve al estado `idle`.

## Decisions

- **Sí:** usar Resend como servicio de envío. API HTTP simple, sin credenciales SMTP, sin necesidad de dominio propio para empezar.
- **No:** Nodemailer + SMTP. Requeriría una cuenta SMTP existente (ej. Gmail con app password), más configuración para un caso simple de formulario de contacto.
- **Sí:** remitente `onboarding@resend.dev`, la dirección de pruebas de Resend. No hay dominio propio verificado; permite enviar correos reales de inmediato una vez configurada la API key.
- **No:** verificar un dominio propio en Resend. Fuera de alcance — se puede migrar después si el proyecto adquiere un dominio.
- **Sí:** destinatario fijo `maxdn.06@gmail.com`, hardcodeado en el Route Handler. No hay múltiples destinatarios ni configuración por variable de entorno para el destino.
- **Sí:** `RESEND_API_KEY` en `.env.local`, no versionada (ya cubierta por `.env*` en `.gitignore`). Evita exponer la key en el repositorio.
- **No:** validación de formato de correo (regex) en el formulario. Se mantiene igual al template — solo valida que los campos no estén vacíos. Mantiene el comportamiento visual (`shake`) idéntico al original.
- **No:** protección anti-spam (honeypot u otra). Fuera de alcance para esta spec; se puede agregar después si se detectan abusos.
- **Sí:** agregar un estado `error` nuevo al formulario, distinto del template original (que solo simulaba éxito). Necesario porque ahora el envío es real y puede fallar (red, límite de Resend, key inválida).
- **Sí:** agregar el link "Acerca de" al Nav ahora. SPEC 02 lo dejó fuera explícitamente porque la página no existía; ahora que se implementa, corresponde exponerlo en la navegación.
- **No:** persistir los mensajes de contacto en ningún lado (base de datos, logs estructurados, archivo). El correo es el único registro del mensaje.

## What is **not** in this spec

- Validación de formato de correo (regex) en el formulario.
- Protección anti-spam (honeypot u otra).
- Persistencia de los mensajes enviados.
- Verificación de dominio propio en Resend.
- Rate limiting del endpoint `/api/contacto`.
- Cambios a Home, Biblioteca, Detalle, Reproductor, Auth o Salón.

Cada uno de estos, si se implementa, va en su propia spec.
