# Conciliación bancaria RAON

Conciliá el extracto del banco con tu planilla en minutos y sabé cuánta plata es de cada cliente.

![CI](https://github.com/RAON/conciliacion-bancaria/actions/workflows/ci.yml/badge.svg)

La Fase 1 incluye lectura de CSV/XLSX, normalización regional, motor de cruce determinístico,
control de cierre, saldos de terceros, Excel de siete hojas y una CLI. La interfaz web completa
forma parte de la Fase 2.

## Privacidad

El núcleo recibe bytes y no usa red ni base de datos. La futura interfaz procesa los archivos en
el navegador. No se guardan movimientos ni extractos. El diseño toma la Ley 18.331 de Uruguay
como marco, sin afirmar certificaciones.

## Correr localmente

    npm ci
    npm run conciliar -- --banco test-data/banco.csv --planilla test-data/planilla.csv --moneda UYU
    npm run dev

El comando imprime el resumen y deja el archivo generado en salida/. Podés indicar el nombre que
se muestra en el Resumen y en el archivo con `--nombre-banco "BROU"`. Para un formato no detectado,
podés agregar `--mapeo mapeo.json` con objetos banco y planilla.

## Verificación

    npm run lint
    npm run typecheck
    npm test
    npm run build

Los datos de test-data/ y public/demo/ son completamente inventados.

## Autor y licencia

RAON — Juan Martín Rampa Lanese (JuanMa). Web, LinkedIn y contacto: marcadores a completar.

© 2026 RAON. Todos los derechos reservados. El código se publica para mostrar el trabajo; para
usarlo en tu negocio, contactanos.
