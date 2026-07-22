# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Skills

- Usa siempre `/frontend-design` para diseñar la interfaz de usuario.
- El proyecto sigue **Spec Driven Design**: usa `/spec` para diseñar una funcionalidad nueva (produce un spec en `specs/`, no escribe código) y `/spec-impl <NN-nombre-spec>` para implementar un spec ya **Aprobado** (crea una rama con el nombre del spec y avanza paso a paso).
- Usa `/spec-impl-game <NN-nombre-spec>` en vez de `/spec-impl` cuando el spec Aprobado agrega un **juego** al catálogo: delega la implementación en `/spec-impl` (mismas cuatro fases, mismas pausas) y, al terminar y verificar los criterios de aceptación, encadena automáticamente `skin-designer` y luego `mobile-porter` (agentes, secuencial, nunca en paralelo) sobre el juego recién implementado, para que quede con skins y controles móviles sin pedirlo aparte.
- Usa `/nuevo-juego <slug>` cuando se quiera agregar un juego jugable nuevo al catálogo: genera el spec combinando los patrones de SPEC 05 (motor en canvas) y SPEC 06 (catálogo/leaderboard en Supabase).
- Los skills provienen del pack `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`, ver `skills-lock.json`).

## Agentes

Detalle completo de cada uno en su archivo `.claude/agents/<nombre>.md`.

- `game-planner`: propone qué juego nuevo conviene agregar al catálogo (categoría, factibilidad, reconocimiento). No escribe specs ni código.
- `game-jam`: genera 2 specs Draft con enfoques de diseño alternativos para un juego concreto, listos para revisar. No implementa código.
- `skin-designer`: audita e implementa selector de skins (paletas de color, patrón Tetris) para un juego concreto del catálogo. Edita código real.
- `mobile-porter`: audita e implementa controles táctiles móviles (SPEC 10) para un juego concreto del catálogo. Edita código real.
- `game-performance`: audita e implementa los patrones de rendimiento de SPEC 12 (fondo offscreen, shadows condicionadas a `glow`, cacheo por-frame) para un juego concreto del catálogo. Edita código real.
- `security-auditor`: audita toda la app (no un juego puntual) contra el baseline de seguridad de SPEC 13/14 — RLS y policies de `games`/`scores`, complejidad de password, headers HTTP, protección de rutas del proxy. Solo lectura: reporta hallazgos con el fix propuesto, no edita código ni aplica migraciones.

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos") — Next.js App Router + TypeScript + Tailwind CSS v4, con estética retro/CRT.

Estado actual: los specs `01`–`11` están **implementados**; el spec `12` (rendimiento) está **Aprobado** y se viene aplicando juego por juego vía el agente `game-performance` (ya cubrió Frogger, Serpiente y Tetris). La plataforma tiene:

- **5 juegos reales en canvas**: Asteroides, Tetris, Arkanoid, Serpiente y Frogger (`components/games/*.tsx`), cada uno con su reproductor dedicado en `app/juego/<slug>/jugar/page.tsx`, selector de skins y controles táctiles móviles (`TouchControls`) ya integrados. Listado con metadata al día en `references/implement-games.md`.
- **Catálogo y leaderboards reales en Supabase** (tablas `games` y `scores`): biblioteca en `/juego`, detalle en `/juego/[id]`, Salón de la Fama en `/salon` (top 10 global + tabs por juego, auto-descubiertos desde la tabla `games`).
- **Pseudo-auth local** (`app/context/AuthContext.tsx` + `/auth`): nombre de jugador en `localStorage["av_user"]`; el modal de fin de partida guarda iniciales en `localStorage["av_last_player_name"]`.
- **Contacto** (`/acerca-de` + `app/api/contacto/route.ts`): envío real de email vía Resend.

## Workflow de specs

- Los specs viven en `specs/NN-nombre.md` con un campo `> **Status:**` (Borrador → Aprobado → Implementado). No implementes un spec que no esté Aprobado; al terminar, actualiza su Status a Implementado y marca sus criterios de aceptación.
- `references/started-games/` contiene los motores originales (HTML/JS vanilla) que se portan a React; `references/source-assets/` tiene sprites y assets fuente; los assets usados en runtime se copian a `public/games/`.

## Patrón para juegos nuevos

Cada juego es un componente `"use client"` con un único `<canvas>`, escalado por CSS al contenedor `.crt-screen`, y acepta exactamente estas 5 props: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`. Su página de reproductor es un clon estructural de `app/juego/asteroides/jugar/page.tsx` (HUD, PAUSA/FIN/SALIR, modal de fin que inserta en `scores` vía `insertScore`). Además: fila nueva en la tabla `games` (migración vía `mcp__supabase__apply_migration`) y clase `.cover-<slug>` en `app/globals.css`. Limpia listeners y loops (`requestAnimationFrame`/`setInterval`) al desmontar.

## Datos (Supabase)

- Cliente browser en `lib/supabase/client.ts`, server en `lib/supabase/server.ts`; queries en `lib/supabase/games.ts` y `lib/supabase/scores.ts`; tipos compartidos en `lib/supabase/types.ts` (`Game`, `ScoreRow`, `CATS`).
- `best` y `plays` de cada juego son calculados desde `scores`, no almacenados.
- Usa las herramientas MCP de Supabase (`mcp__supabase__*`) para migraciones, SQL y logs; los cambios de esquema van como migraciones, no SQL suelto.

## Env vars

`.env.local` (plantilla en `.env.template`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`.

## Stack notes

- Next.js `16.2.10`, React `19.2.4` — **this is not the Next.js version in your training data**; per AGENTS.md, consult `node_modules/next/dist/docs/` (App Router docs under `01-app/`) before using any API you're not certain is unchanged, and watch for deprecation notices.
- Path alias `@/*` resolves to the project root (see `tsconfig.json`).
- Tailwind CSS v4 via `@tailwindcss/postcss` (config lives in `postcss.config.mjs`; no separate `tailwind.config.*`).
- Supabase via `@supabase/ssr` + `@supabase/supabase-js`; emails via `resend`.
- No hay setup de tests; verifica con `npm run lint`, `npm run build` y probando en el navegador (guarda capturas de Playwright en `.playwright-screenshots/`).
