# Prompts para Codex — Conciliación bancaria

## Antes de empezar (una sola vez)
1. Abrí una terminal en esta carpeta y creá el repo git (Codex trabaja mejor así):
   ```
   git init
   git add .
   git commit -m "docs: spec y agents"
   ```
2. Abrí esta carpeta en Codex (app de escritorio, extensión de VS Code o `codex` en la terminal). En la Fase 1 necesita internet para instalar los paquetes.

## Una fase por vez
Mandá el prompt, revisá lo que hizo, probá lo que diga "Probar a mano" en el registro de `SPEC.md` y hacé commit. Después pasás a la siguiente.

### Fase 1 — Motor, Excel y consola
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO la Fase 1 de SPEC.md.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test y npm run build.
Marcá en SPEC.md los ítems de la Fase 1 que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Correcciones de la revisión de la Fase 1 (antes de la Fase 2)
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO los ítems de "Correcciones de la revisión (2026-11-24)" de la Fase 1 en SPEC.md. Cada corrección lleva su test.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test, npm run build y npm audit sin vulnerabilidades. Volvé a generar el Excel con la CLI y revisá la hoja Resumen.
Marcá en SPEC.md los ítems que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Fase 2 — Interfaz web sin backend
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO la Fase 2 de SPEC.md.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test y npm run build.
Marcá en SPEC.md los ítems de la Fase 2 que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Correcciones de la revisión de la Fase 2 (antes de la Fase 3)
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO los ítems de "Correcciones de la revisión (2026-11-26)" de la Fase 2 en SPEC.md. Empezá por el de aceptar dudosos (es un error del motor y lleva test). Cada corrección que se pueda probar lleva su test.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test, npm run build y npm audit sin vulnerabilidades. Revisá con capturas en 320, 390, 768 y 1366 px que ninguna pantalla tenga scroll horizontal.
Marcá en SPEC.md los ítems que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Fase 3 — Cuentas y datos guardados (Supabase)
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO la Fase 3 de SPEC.md.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test y npm run build.
Marcá en SPEC.md los ítems de la Fase 3 que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Correcciones de la revisión de la Fase 3 (antes de la Fase 4)
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO los ítems de "Correcciones de la revisión (2026-11-27)" de la Fase 3 en SPEC.md. Los permisos van en una migración nueva, sin editar la anterior. El test de RLS con PGlite tiene que cubrir los 7 casos de la SPEC y fallar si se vuelven a abrir los permisos.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test, npm run build y npm audit sin vulnerabilidades.
Marcá en SPEC.md los ítems que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Fase 4 — IA opcional, seguridad y pulido
```
Leé AGENTS.md y SPEC.md completos. Implementá SOLO la Fase 4 de SPEC.md.
Antes de terminar, tienen que pasar npm run lint, npm run typecheck, npm test y npm run build.
Marcá en SPEC.md los ítems de la Fase 4 que quedaron hechos y escribí en "Registro de avances" qué hiciste, qué decidiste y qué tengo que probar a mano.
```

### Auditoría de seguridad (después de la Fase 4)
```
Hacé una auditoría de seguridad del repo: buscá secretos o datos reales commiteados (también en el historial de git), corré npm audit y revisá la validación de entradas, las políticas RLS de Supabase, el uso de la service_role, los encabezados de seguridad y que la IA esté apagada por defecto. Arreglá lo que encuentres y anotá en el registro lo que no se pudo arreglar.
```

## Al final
1. Creá en GitHub el repo público `raon-conciliacion-bancaria` (vacío, sin README) y subí lo que tenés:
   ```
   git remote add origin https://github.com/TU_USUARIO/raon-conciliacion-bancaria.git
   git branch -M main
   git push -u origin main
   ```
2. Deploy en Vercel con `NEXT_PUBLIC_DEMO_MODE=true`.
3. Poné el link de la demo y un GIF en el README.
