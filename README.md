# Conciliación bancaria RAON

Conciliá el extracto del banco con tu planilla en minutos y sabé cuánta plata es de cada cliente.

![CI](https://github.com/RAON/conciliacion-bancaria/actions/workflows/ci.yml/badge.svg)

La aplicación incluye lectura de CSV/XLSX, normalización regional, motor de cruce determinístico,
control de cierre, saldos de terceros, Excel de siete hojas, una CLI y una interfaz web completa
que procesa todo en un Web Worker.

## Privacidad

El núcleo recibe bytes y no usa red ni base de datos. La interfaz procesa los archivos en el
navegador. No se guardan movimientos ni extractos; solo reglas y plantillas de columnas quedan en
`localStorage`. El diseño toma la Ley 18.331 de Uruguay
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

## Deploy en Vercel

1. Importá el repositorio en Vercel y elegí el preset **Next.js**.
2. Usá Node.js 20 o superior. Los comandos predeterminados (`npm ci` y `npm run build`) son suficientes.
3. Si el deploy es una demo pública, agregá `NEXT_PUBLIC_DEMO_MODE=true` en **Project Settings → Environment Variables** para Production, Preview y Development.
4. No configures Supabase ni servicios de archivos en esta fase: la lectura, el motor y el Excel corren en el navegador.
5. Desplegá y probá `/`, `/conciliar`, `/resultado` y `/reglas`. La navegación directa a `/resultado` sin una conciliación muestra el estado vacío esperado.

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
