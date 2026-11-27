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

1. Creá un proyecto y aplicá, en orden, todas las migraciones de `supabase/migrations/` con Supabase CLI (`supabase db push`) o desde el SQL Editor.
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

### Verificación automática de RLS

`tests/rls.test.ts` levanta Postgres en memoria con PGlite, crea el esquema `auth` mínimo de
Supabase y aplica todas las migraciones en orden. Sus siete casos prueban el alta inicial, el
aislamiento entre organizaciones, las escrituras cruzadas, la administración de miembros, los
permisos anónimos y la autoría de las conciliaciones. También comprueba los `GRANT` efectivos para
fallar si vuelven a abrirse permisos.

    npm test -- tests/rls.test.ts

### Pruebas manuales restantes

1. En un proyecto Supabase real, pedí el enlace desde `/cuenta`, abrilo en el mismo navegador y
   confirmá que vuelve a `/historial` con la sesión activa.
2. Cerrá sesión y visitá directamente `/conciliar`, `/reglas`, `/resultado` y `/historial`: con
   Supabase configurado deben redirigir a `/cuenta` y conservar el destino después del login.
3. Quitá `NEXT_PUBLIC_SUPABASE_URL` y la clave pública, reiniciá la aplicación y verificá que las
   rutas abren sin login, y que reglas, plantillas y resúmenes siguen usando `localStorage`.

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
