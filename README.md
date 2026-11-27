# Conciliación bancaria RAON

Conciliá el extracto del banco con tu planilla en minutos y sabé cuánta plata es de cada cliente.

![CI](https://github.com/RAON/conciliacion-bancaria/actions/workflows/ci.yml/badge.svg)

La aplicación incluye lectura de CSV/XLSX, normalización regional, motor de cruce determinístico,
control de cierre, saldos de terceros, Excel de siete hojas, una CLI y una interfaz web completa
que procesa todo en un Web Worker.

## Privacidad

El núcleo recibe bytes y no usa red ni base de datos. La interfaz procesa los archivos en el
navegador. No se guardan movimientos ni extractos. En modo local, reglas, plantillas y resúmenes
quedan en `localStorage`; con Supabase configurado, se guardan por organización las reglas,
plantillas y los totales agregados de cada conciliación. El diseño toma la Ley 18.331 de Uruguay
como marco, sin afirmar certificaciones.

## Correr localmente

    npm ci
    npm run conciliar -- --banco test-data/banco.csv --planilla test-data/planilla.csv --moneda UYU
    npm run dev

El comando imprime el resumen y deja el archivo generado en salida/. Podés indicar el nombre que
se muestra en el Resumen y en el archivo con `--nombre-banco "BROU"`. Para un formato no detectado,
podés agregar `--mapeo mapeo.json` con objetos banco y planilla.

Para mostrar el banner de demo y cargar los archivos ficticios desde la interfaz, copiá
`.env.example` a `.env.local`, definí `NEXT_PUBLIC_DEMO_MODE=true` y reiniciá `npm run dev`.

Sin `NEXT_PUBLIC_SUPABASE_URL` y una clave pública válida, la aplicación mantiene el mismo modo
local sin login. Los placeholders de `.env.example` también se consideran configuración ausente.

## Configurar Supabase

1. Creá un proyecto y aplicá `supabase/migrations/202611270001_fase3.sql` con Supabase CLI (`supabase db push`) o desde el SQL Editor.
2. En **Authentication → URL Configuration**, agregá `http://localhost:3000/auth/callback` y la URL equivalente del deploy a las redirect URLs permitidas.
3. Definí estas variables en `.env.local` y reiniciá el servidor:

       NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

   También se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` para proyectos que todavía usan la clave
   pública legacy. Nunca uses la `service_role` en variables `NEXT_PUBLIC_*`.
4. Entrá a `/cuenta`, pedí el magic link y abrilo en el mismo navegador. En el primer ingreso se
   crea una organización, el usuario queda con rol `owner` y se cargan las reglas bancarias
   predeterminadas.

La migración habilita RLS en `organizaciones`, `miembros`, `cuentas`, `plantillas_banco`, `reglas`
y `conciliaciones`. Todas las consultas de la aplicación llevan `organizacion_id`; las políticas
comprueban la membresía con `auth.uid()`.

### Prueba manual de RLS

Este proyecto no incluye un contenedor local de Supabase para ejecutar pgTAP en CI. Antes de usar
un proyecto real, verificá el aislamiento así:

1. Abrí una ventana normal, ingresá con `usuario-a@example.test`, creá una regla, ejecutá una
   conciliación demo y confirmá que aparece en `/historial`.
2. Abrí una ventana de incógnito, ingresá con `usuario-b@example.test` y confirmá que se crea otra
   organización: no deben aparecer ni la regla ni el resumen del usuario A.
3. Con la sesión B, usá el cliente Supabase del navegador o una llamada REST autenticada para
   seleccionar y actualizar los ids de la organización A. La selección debe devolver cero filas y
   la modificación no debe afectar ninguna fila.
4. Cerrá sesión y visitá directamente `/conciliar`, `/reglas`, `/resultado` y `/historial`: con
   Supabase configurado deben redirigir a `/cuenta`. Quitá las dos variables de Supabase, reiniciá
   y repetí: las rutas deben abrir en modo local sin pedir login.
5. En el Table Editor, revisá una fila de `conciliaciones`: debe contener sólo cuenta, período,
   cantidades, porcentajes, totales por estado, cierre, autor y fecha; nunca descripciones,
   movimientos ni bytes de archivos.

## Deploy en Vercel

1. Importá el repositorio en Vercel y elegí el preset **Next.js**.
2. Usá Node.js 20 o superior. Los comandos predeterminados (`npm ci` y `npm run build`) son suficientes.
3. Si el deploy es una demo pública, agregá `NEXT_PUBLIC_DEMO_MODE=true` en **Project Settings → Environment Variables** para Production, Preview y Development.
4. Para habilitar cuentas, agregá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; si las omitís, el deploy conserva el modo local.
5. Desplegá y probá `/`, `/cuenta`, `/conciliar`, `/resultado`, `/reglas` y `/historial`. La navegación directa a `/resultado` sin una conciliación muestra el estado vacío esperado.

Vercel sirve la aplicación Next.js; ningún route handler recibe los archivos. Las variables con
prefijo `NEXT_PUBLIC_` quedan incluidas en el build, por lo que un cambio requiere un nuevo deploy.

## Verificación

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm audit

Los datos de test-data/ y public/demo/ son completamente inventados.

## Autor y licencia

RAON — Juan Martín Rampa Lanese (JuanMa). Web, LinkedIn y contacto: marcadores a completar.

© 2026 RAON. Todos los derechos reservados. El código se publica para mostrar el trabajo; para
usarlo en tu negocio, contactanos.
