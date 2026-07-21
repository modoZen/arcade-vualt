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

- `game-planner` (`.claude/agents/game-planner.md`): decide qué juego nuevo conviene agregar al catálogo, evaluando diversidad de categorías, factibilidad con el stack actual (Canvas puro, sin assets pesados) y reconocimiento clásico, en ese orden de peso. Investiga `specs/`, `references/started-games`, `references/source-assets` y la tabla `games` de Supabase antes de proponer. Mantiene su historial de sugerencias en `references/game-suggestion-todo.md` (nunca lo reescribe, solo agrega filas) para no repetir ideas ya rechazadas. No escribe specs ni código — si el usuario elige un candidato, el siguiente paso es `/nuevo-juego <slug>`.
- `game-jam` (`.claude/agents/game-jam.md`): recibe **un juego** concreto (nombre/slug, opcionalmente con una carpeta de referencia bajo `references/`) y crea `specs/game-jam/<game-id>/` con 2 specs completos (`Status: Draft`) que documentan **enfoques de diseño alternativos** de ese mismo juego (distinta mecánica, controles, progresión o mapeo de HUD), listos para revisión — a diferencia de `/nuevo-juego`, trabaja de forma autónoma sin pausar a preguntar. Registra su propuesta en `references/game-suggestion-todo.md`. No implementa código ni aplica migraciones; elegir y promover un enfoque a spec numerado real es trabajo manual del usuario o de `/nuevo-juego`.
- `skin-designer` (`.claude/agents/skin-designer.md`): recibe **un juego** concreto del catálogo, audita si ya tiene un selector de skins (paletas de color intercambiables desde el HUD, con persistencia en `localStorage`) y, si no lo tiene, se lo implementa calcando el patrón real de Tetris (`components/games/TetrisGame.tsx` + `app/juego/tetris/jugar/page.tsx`) — a diferencia de `game-planner`/`game-jam`, sí edita código real y no persiste ningún doc/TODO, solo reporta en el chat. Agrega el prop `skin` como desviación consciente de la regla de "exactamente 5 props".
- `mobile-porter` (`.claude/agents/mobile-porter.md`): recibe **un juego** concreto del catálogo con reproductor real y audita si ya tiene el sistema de controles móviles de SPEC 10 (`TouchControls` debajo del canvas + overlay `.landscape-lock` + breakpoint mobile compacto); si le falta, se lo implementa calcando el patrón real de los 4 juegos reales (`components/games/TouchControls.tsx` + `app/juego/{asteroides,tetris,arkanoid,serpiente}/jugar/page.tsx`), infiriendo el `directionMode`/botones de acción a partir de cómo el motor lee el teclado — igual que `skin-designer`, edita código real y no persiste doc/TODO, solo reporta en el chat. No modifica el componente motor ni sus 5 props; si el juego resuelve al reproductor genérico `app/juego/[id]/jugar/page.tsx` (sin motor real), no hay nada que portar.
- `game-performance` (`.claude/agents/game-performance.md`): recibe **un juego** concreto del catálogo con motor real y audita cuáles de los 3 patrones de rendimiento de SPEC 12 le aplican (fondo estático en canvas offscreen, shadows condicionadas a `glow`, cacheo de un cálculo puro por-frame); los que apliquen se implementan calcando `components/games/FroggerGame.tsx`, verificando paridad visual pixel-idéntica con capturas Playwright antes/después — igual que `skin-designer`/`mobile-porter`, edita código real (solo el componente motor) y no persiste doc/TODO, solo reporta en el chat. Si un patrón no tiene hotspot real en ese juego, lo reporta como "no aplica" en vez de forzarlo; no toca física, colisiones ni las 5 props.

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos") — Next.js App Router + TypeScript + Tailwind CSS v4, con estética retro/CRT.

Estado actual: los specs `01`–`09` están **implementados**. La plataforma tiene:

- **4 juegos reales en canvas**: Asteroides, Tetris, Arkanoid y Serpiente (`components/games/*.tsx`), cada uno con su reproductor dedicado en `app/juego/<slug>/jugar/page.tsx`. And more... (reference: references/implement-games.md)
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
