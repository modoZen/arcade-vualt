---
name: spec-impl-game
description: Como /spec-impl pero para specs de juegos del catálogo. Implementa el spec aprobado paso a paso (delegando en /spec-impl) y, al terminar y verificar los criterios, detona automáticamente skin-designer y luego mobile-porter (secuencial, nunca en paralelo) sobre el juego recién implementado.
disable-model-invocation: true
argument-hint: "<NN-nombre-spec>"
---

# /spec-impl-game — Implementer de specs de juego + skins + mobile automáticos

## Philosophy

Este skill es un `/spec-impl` especializado para specs que agregan un **juego** al
catálogo de Arcade Vault. La implementación en sí es idéntica a `/spec-impl` — no
se reinventa ni se copia esa lógica, se **delega** en ella. La única diferencia es
lo que pasa _después_: en este catálogo, todo juego real nuevo termina recibiendo
las mismas dos mejoras estándar — un selector de skins (patrón Tetris) y controles
móviles (SPEC 10) — y hoy eso se dispara a mano invocando `skin-designer` y luego
`mobile-porter`. Este comando encadena ambos pasos automáticamente al terminar la
implementación, sin que el usuario tenga que acordarse de pedirlos.

## Instrucciones

El argumento recibido es: `$ARGUMENTS`

### Fase A — Implementar el spec (delegar en `/spec-impl`)

Invoca el skill `spec-impl` (herramienta **Skill**, `skill: "spec-impl"`) pasándole
`$ARGUMENTS` tal cual. `disable-model-invocation: true` en `spec-impl` solo bloquea
su auto-invocación implícita por descripción — invocarlo explícitamente así está
permitido y es exactamente el mecanismo de este comando.

Sigue **las cuatro fases de `spec-impl` al pie de la letra**, sin saltarte ninguna
pausa ni condición:

1. Identificar el spec a partir de `$ARGUMENTS` (nombre completo, número o slug).
2. Validar que el `Status` del spec significa "Approved" en cualquier idioma. Si no
   lo es (Draft/Borrador, En revisión, Implementado, Obsoleto, o valor no
   reconocido), **detente aquí** con el mensaje de error estándar de `spec-impl`.
   **No avances a la Fase B de este comando ni lances ningún agente.**
3. Crear/cambiar a la rama `spec-NN-slug` respetando `AutoCreateBranch`.
4. Implementar paso a paso, pausando tras cada paso para que el usuario revise el
   diff, exactamente como especifica `spec-impl`.
5. Al completar el último paso, verificar los criterios de aceptación uno por uno
   y actualizar el `Status` del spec a "Implemented" (o el equivalente), tal como
   indica `spec-impl`.

**Regla dura:** no continúes a la Fase B hasta que la implementación esté
completa y los criterios de aceptación estén verificados. Si `spec-impl` se
detiene en cualquier fase (spec no encontrado, estado no aprobado, ambigüedad sin
resolver, rama rechazada), este comando también se detiene ahí. No hay Fase B ni
Fase C en ese caso.

### Fase B — Derivar el slug del juego

Con la implementación terminada, deduce el **slug** del juego directamente de lo
que el spec describió y de lo que se acaba de implementar:

- El `id` de la fila insertada en la tabla `games` (migración aplicada durante la
  Fase A), y/o
- El segmento `<slug>` de la ruta `app/juego/<slug>/jugar/page.tsx` creada.

Ambas fuentes deberían coincidir. Si coinciden, continúa sin pausar — no pidas
confirmación por costumbre. Solo si el slug es genuinamente ambiguo (por ejemplo,
el spec describe más de un juego, o las dos fuentes no coinciden), detente y
pregunta al usuario cuál es el slug correcto antes de seguir.

### Fase C — Detonar skin-designer y mobile-porter (automático, secuencial)

Con el slug ya resuelto, anuncia brevemente al usuario que vas a aplicar las dos
mejoras estándar del catálogo y lanza los agentes **uno después del otro, nunca
en el mismo mensaje ni en paralelo**:

1. Invoca el agente `skin-designer` (Agent, `subagent_type: "skin-designer"`,
   `run_in_background: false`) con el slug/nombre del juego. Espera su resultado
   completo antes de continuar.
2. Solo después de recibir el reporte de `skin-designer`, invoca el agente
   `mobile-porter` (Agent, `subagent_type: "mobile-porter"`, `run_in_background: false`)
   con el mismo slug/nombre del juego.

Ambos agentes reportan únicamente en el chat (no persisten doc/TODO) — resume en
el chat, para el usuario, qué hizo cada uno (si ya tenía skins/mobile o si los
implementó, qué archivos tocó).

El orden importa: `skin-designer` y `mobile-porter` pueden editar el mismo archivo
(`app/juego/<slug>/jugar/page.tsx`), así que lanzarlos en paralelo arriesgaría un
conflicto de edición. Por eso siempre es secuencial y siempre skin primero.

## Hard rules

- **Nunca** lances `skin-designer` y `mobile-porter` en el mismo mensaje ni en
  paralelo. Siempre `skin-designer` completo primero, después `mobile-porter`.
- **Nunca** lances ningún agente si la Fase A no terminó completamente (spec no
  aprobado, implementación incompleta, o criterios de aceptación no verificados).
- **No dupliques** la lógica de `/spec-impl`: toda la fase de implementación se
  hace invocándolo, no reimplementando sus fases desde cero.
- Si el usuario pide algo fuera del alcance del spec durante la Fase A, sigue la
  misma regla que `spec-impl`: recuérdale que está fuera de alcance y sugiere
  anotarlo para otro spec.
