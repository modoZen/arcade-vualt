# SPEC 04 — Setup e integración base de Supabase

> **Status:** Implementado
> **Depends on:** Ninguna spec funcionalmente; reutiliza el patrón de variables de entorno de SPEC 03 (`.env.local` no versionado, documentado con placeholder vacío en `.env.template`).
> **Date:** 2026-07-15
> **Objective:** Instalar y configurar los clientes base de Supabase (`@supabase/ssr` + `@supabase/supabase-js`) para Next.js App Router en `lib/supabase/`, sin conectar ninguna autenticación ni feature todavía, dejando la infraestructura lista para specs futuras.

## Scope

**In:**

- Instalar las dependencias `@supabase/supabase-js` y `@supabase/ssr` (`npm install`, actualiza `package.json` y `package-lock.json`).
- Crear `lib/supabase/client.ts` — cliente para Client Components (`createBrowserClient`).
- Crear `lib/supabase/server.ts` — cliente para Server Components/Route Handlers (`createServerClient` + `cookies()` de `next/headers`).
- Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.local` (valores reales del proyecto ya conectado) y sus placeholders vacíos a `.env.template`, siguiendo el mismo patrón que `RESEND_API_KEY`/`SUPABASE_DB_PASSWORD`.

**Out of scope (para futuras specs):**

- `proxy.ts` (antes `middleware.ts`) para refresco de sesión — no tiene sentido sin autenticación real conectada; se agrega en la spec de auth.
- Cualquier lógica de autenticación real (reemplazar `AuthContext`, métodos de login, OAuth) — spec futura ya acordada.
- Cualquier tabla en la base de datos (scores, catálogo de juegos) y sus políticas de RLS — specs futuras ya acordadas.
- Configuración de la CLI de Supabase, migraciones locales, o uso de `SUPABASE_DB_PASSWORD` (esa variable ya existe pero es para conexión directa a la DB/migraciones, no para el cliente de la app) — fuera de alcance aquí.
- Cualquier cambio visual o de UI en pantallas existentes.

## Data model

No se introduce ningún modelo de datos persistente en este spec. Los clientes de Supabase son utilidades de configuración, no estructuras de datos.

## Implementation plan

1. Instalar las dependencias `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`).
2. Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.local` con los valores reales del proyecto ya conectado (`https://geovfquhhpowanqzxgzc.supabase.co` y la publishable key correspondiente), y sus placeholders vacíos a `.env.template`.
3. Crear `lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr`.
4. Crear `lib/supabase/server.ts` con `createClient()` (async) usando `createServerClient` de `@supabase/ssr` junto con `cookies()` de `next/headers`.
5. Verificar la integración: confirmar que ambos archivos existen, correr el chequeo de tipos de TypeScript sin errores, y correr `npm run build` (o `npm run dev`) hasta confirmar que termina sin errores de compilación.

## Acceptance criteria

- [x] `lib/supabase/client.ts` existe y exporta `createClient()` usando `createBrowserClient` de `@supabase/ssr`.
- [x] `lib/supabase/server.ts` existe y exporta `createClient()` (async) usando `createServerClient` de `@supabase/ssr` con `cookies()` de `next/headers`.
- [x] `@supabase/supabase-js` y `@supabase/ssr` aparecen como dependencias en `package.json`.
- [x] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con valores reales.
- [x] `.env.template` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como placeholders vacíos (sin valores reales).
- [x] El chequeo de tipos de TypeScript no reporta errores.
- [x] `npm run build` (o `npm run dev`) termina sin errores de compilación.
- [x] Ninguna pantalla, componente ni ruta existente cambia de comportamiento (no hay features conectadas a estos clientes todavía).

## Decisions

- **Sí:** usar `@supabase/ssr` (en vez de solo `@supabase/supabase-js`) para tener clientes browser/server correctamente configurados con cookies desde el inicio. Es el patrón oficial de Supabase para Next.js App Router y evita tener que migrar más adelante cuando se agregue autenticación real.
- **No:** implementar `proxy.ts` (antes `middleware.ts`) en este spec. Su único propósito es refrescar tokens de sesión, y todavía no hay autenticación real que produzca esos tokens — agregarlo ahora sería infraestructura sin uso. Se agrega en la spec de autenticación.
- **Sí:** usar la convención nueva de keys (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `sb_publishable_...`) en vez de la legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Supabase mantiene la legacy solo hasta fines de 2026 y recomienda migrar ya.
- **Sí:** archivos en `lib/supabase/client.ts` y `lib/supabase/server.ts`, siguiendo la convención por defecto de la documentación oficial de Supabase para Next.js.
- **Sí:** reutilizar el proyecto Supabase ya conectado (`geovfquhhpowanqzxgzc.supabase.co`, sin tablas) en vez de crear uno nuevo. `SUPABASE_DB_PASSWORD` ya estaba documentado en `.env.local`/`.env.template` desde antes de este spec.
- **No:** crear ninguna tabla, política de RLS, o ruta de verificación (health-check) en este spec. La verificación se limita a compilación/tipado (build + `tsc`), sin necesidad de un endpoint que llame a Supabase en runtime — decisión explícita del usuario para mantener el spec estrictamente de infraestructura.
- **No:** conectar `AuthContext` ni ninguna pantalla a estos clientes. Es la base para specs futuras (autenticación, persistencia de scores, catálogo de juegos), cada una con su propio spec.

## What is **not** in this spec

- `proxy.ts` para refresco de sesión.
- Autenticación real (reemplazar `AuthContext`, métodos de login, OAuth).
- Tablas de base de datos (scores, catálogo de juegos) y políticas de RLS.
- Configuración de la CLI de Supabase, migraciones locales, o uso de `SUPABASE_DB_PASSWORD`.
- Cambios visuales o de UI en pantallas existentes.

Cada uno de estos, si se implementa, va en su propia spec.
