# AGENTS.md — Instrucciones para Codex

Proyecto: **Conciliación bancaria RAON**. Es un repositorio **público** que funciona como portfolio y como producto que se vende.
La especificación completa está en `SPEC.md`. Leela entera antes de tocar código.

## Cómo trabajar
- Implementá **solo la fase que pide la tarea**. No adelantes trabajo de otras fases.
- Si el repo ya tiene código de una versión anterior, no lo tires: comparalo con la SPEC, reutilizá lo que sirva y anotá en el registro qué cambiaste y por qué.
- Al terminar una fase tienen que pasar: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
- Marcá con `[x]` en `SPEC.md` los ítems terminados y escribí una entrada en "Registro de avances": qué hiciste, qué decidiste y qué hay que probar a mano.
- Si algo es ambiguo, elegí la opción más simple y segura y anotala en el registro.

## Comandos
| Acción | Comando |
|---|---|
| Instalar | `npm ci` |
| Desarrollo | `npm run dev` |
| Lint | `npm run lint` |
| Tipos | `npm run typecheck` |
| Tests | `npm test` |
| Build | `npm run build` |
| Conciliar por consola | `npm run conciliar -- --banco <archivo> --planilla <archivo> --moneda UYU` |

## Idioma y estilo
- Interfaz, README, mensajes de error, comentarios y commits en **español** (rioplatense, "vos").
- Nombres del dominio en español: `movimiento`, `conciliacion`, `regla`, `plantillaBanco`.
- Commits con Conventional Commits en español: `feat: cruce por monto exacto`, `fix: fechas seriales de Excel`.
- TypeScript en modo `strict`. Sin `any` salvo que esté justificado en un comentario.

## Reglas que no se negocian
1. **Repo público:** nunca commitear secretos, `.env`, datos reales de clientes ni extractos reales. Solo datos inventados en `test-data/` y `public/demo/`.
2. Variables de entorno documentadas en `.env.example` con valores falsos.
3. **Montos siempre en centavos (enteros).** Nunca sumar ni comparar montos en punto flotante.
4. El motor (`lib/motor/`) son **funciones puras**: sin red, sin base de datos, sin leer la fecha del sistema. Todo cambio del motor lleva test.
5. Los archivos del usuario se procesan **en el navegador** (Web Worker). No se suben al servidor, no se guardan y no se loguean.
6. **No usar el paquete `xlsx` de npm** (la versión publicada ahí es vieja y tiene vulnerabilidades conocidas). Leer `.xlsx` con ExcelJS y `.csv` con Papa Parse.
7. No usar `next/font/google` (necesita internet durante el build). Usar fuentes del sistema o `next/font/local`.
8. Validar con Zod toda entrada que llegue al servidor.
9. La IA queda apagada por defecto (`AI_ENABLED=false`) y **nunca concilia sola**: solo sugiere.
10. Dependencias mínimas, mantenidas y conocidas.
