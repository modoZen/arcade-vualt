# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos") — currently an unmodified `create-next-app` scaffold (App Router, TypeScript, Tailwind CSS v4) with no game/vault features implemented yet.

The README indicates this project intends to follow a Spec Driven Design workflow (`/spec` and `/spec-impl`) via the `Klerith/fernando-skills` skill pack (`npx skills@latest add Klerith/fernando-skills`). Check whether those skills are installed before starting feature work — if present, use them to drive spec-first development.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript rules)

There is no test setup in this repo currently.

## Stack notes

- Next.js `16.2.10`, React `19.2.4` — **this is not the Next.js version in your training data**; per AGENTS.md, consult `node_modules/next/dist/docs/` (App Router docs under `01-app/`) before using any API you're not certain is unchanged, and watch for deprecation notices.
- Path alias `@/*` resolves to the project root (see `tsconfig.json`).
- Tailwind CSS v4 via `@tailwindcss/postcss` (config lives in `postcss.config.mjs`; no separate `tailwind.config.*`).
