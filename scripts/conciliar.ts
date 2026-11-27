import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MapeoColumnas, Moneda } from '@/lib/dominio';
import { controlarCierre } from '@/lib/cierre';
import { generarExcel, nombreArchivoExcel } from '@/lib/excel';
import { leerArchivo } from '@/lib/lectura';
import { conciliar, REGLAS_GASTOS_PREDETERMINADAS } from '@/lib/motor';
import { normalizarFilas } from '@/lib/normalizar';
import { calcularSaldosPorCliente } from '@/lib/saldos';
import { parsearArgumentos, resolverNombreBanco } from '@/scripts/argumentos';

async function cargar(ruta: string): Promise<Uint8Array> {
  const contenido = await readFile(ruta);
  return new Uint8Array(contenido.buffer, contenido.byteOffset, contenido.byteLength);
}

async function principal(): Promise<void> {
  const args = parsearArgumentos(process.argv.slice(2));
  if (!args.banco || !args.planilla || !args.moneda) {
    throw new Error(
      'Uso: npm run conciliar -- --banco <archivo> --planilla <archivo> --moneda UYU [--nombre-banco "BROU"] [--mapeo mapeo.json]',
    );
  }
  const moneda = args.moneda.toUpperCase() as Moneda;
  if (!['UYU', 'USD', 'ARS', 'EUR'].includes(moneda)) {
    throw new Error('La moneda debe ser UYU, USD, ARS o EUR');
  }
  const [lecturaBanco, lecturaPlanilla] = await Promise.all([
    leerArchivo(await cargar(args.banco), args.banco),
    leerArchivo(await cargar(args.planilla), args.planilla),
  ]);
  let mapeos: { banco?: MapeoColumnas; planilla?: MapeoColumnas } = {};
  if (args.mapeo) {
    mapeos = JSON.parse(await readFile(args.mapeo, 'utf8')) as typeof mapeos;
  }
  const banco = normalizarFilas({
    filas: lecturaBanco.filas,
    mapeo: { ...lecturaBanco.mapeoDetectado, ...mapeos.banco },
    origen: 'banco',
    moneda,
  });
  const planilla = normalizarFilas({
    filas: lecturaPlanilla.filas,
    mapeo: { ...lecturaPlanilla.mapeoDetectado, ...mapeos.planilla },
    origen: 'planilla',
    moneda,
  });
  if (banco.movimientos.length === 0 || planilla.movimientos.length === 0) {
    throw new Error('No quedaron movimientos válidos para conciliar');
  }
  const reglas = [
    ...REGLAS_GASTOS_PREDETERMINADAS,
    {
      id: 'DEMO-REF-4471',
      patron: 'REF 4471',
      accion: 'asignar_cliente' as const,
      cliente: 'Gómez',
      origen: 'manual' as const,
    },
  ];
  const { resultados, resumen } = conciliar({
    banco: banco.movimientos,
    planilla: planilla.movimientos,
    reglas,
  });
  const cierre = controlarCierre(banco.movimientos);
  const fondos = calcularSaldosPorCliente(
    planilla.movimientos,
    resultados,
    cierre.saldoFinalCentavos,
  );
  const periodo = banco.movimientos[0].fecha.slice(0, 7);
  const nombreBanco = resolverNombreBanco(args);
  const excel = await generarExcel({
    banco: nombreBanco,
    moneda,
    periodo,
    movimientosBanco: banco.movimientos,
    movimientosPlanilla: planilla.movimientos,
    resultados,
    resumen,
    cierre,
    fondos,
    reglas,
  });
  await mkdir('salida', { recursive: true });
  const rutaSalida = join('salida', nombreArchivoExcel(nombreBanco, moneda, periodo));
  await writeFile(rutaSalida, excel);
  console.log(
    JSON.stringify(
      {
        ...resumen,
        cierre: cierre.mensaje,
        filasExcluidasMoneda: banco.filasExcluidasMoneda + planilla.filasExcluidasMoneda,
        filasInvalidas: banco.errores.length + planilla.errores.length,
        archivo: rutaSalida,
      },
      null,
      2,
    ),
  );
}

principal().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Error inesperado');
  process.exitCode = 1;
});
