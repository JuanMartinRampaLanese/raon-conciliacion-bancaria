import type { Moneda, Regla } from '@/lib/dominio';
import { controlarCierre } from '@/lib/cierre';
import { generarExcel } from '@/lib/excel';
import { leerArchivo } from '@/lib/lectura';
import { conciliar } from '@/lib/motor';
import { normalizarFilas } from '@/lib/normalizar';
import { calcularSaldosPorCliente } from '@/lib/saldos';
import type { ArchivoBytes, DatosConciliacion, PrevisualizacionArchivo, SolicitudWorker } from '@/lib/worker/protocolo';

type Informar = (porcentaje: number, mensaje: string) => void;

export async function previsualizarArchivo(archivo: ArchivoBytes): Promise<PrevisualizacionArchivo> {
  const lectura = await leerArchivo(archivo.bytes, archivo.nombre);
  return {
    encabezados: lectura.encabezados,
    filas: lectura.filas.slice(0, 10),
    mapeoDetectado: lectura.mapeoDetectado,
    filaEncabezado: lectura.filaEncabezado,
    totalFilas: lectura.filas.length,
  };
}

export async function procesarConciliacion(
  entrada: Extract<SolicitudWorker, { tipo: 'conciliar' }>,
  informar: Informar = () => undefined,
): Promise<DatosConciliacion> {
  informar(8, 'Leyendo los archivos');
  const [lecturaBanco, lecturaPlanilla] = await Promise.all([
    leerArchivo(entrada.banco.bytes, entrada.banco.nombre),
    leerArchivo(entrada.planilla.bytes, entrada.planilla.nombre),
  ]);
  informar(30, 'Interpretando fechas y montos');
  const banco = normalizarFilas({
    filas: lecturaBanco.filas,
    mapeo: entrada.mapeoBanco,
    origen: 'banco',
    moneda: entrada.moneda,
  });
  const planilla = normalizarFilas({
    filas: lecturaPlanilla.filas,
    mapeo: entrada.mapeoPlanilla,
    origen: 'planilla',
    moneda: entrada.moneda,
  });
  if (banco.movimientos.length === 0 || planilla.movimientos.length === 0) {
    throw new Error('No quedaron movimientos válidos para conciliar');
  }
  informar(55, 'Cruzando movimientos');
  const { resultados, resumen } = conciliar({
    banco: banco.movimientos,
    planilla: planilla.movimientos,
    reglas: entrada.reglas,
  });
  informar(72, 'Calculando cierre y fondos de terceros');
  const cierre = controlarCierre(banco.movimientos, entrada.saldosManuales);
  const fondos = calcularSaldosPorCliente(
    planilla.movimientos,
    resultados,
    cierre.saldoFinalCentavos,
  );
  const periodo = banco.movimientos[0].fecha.slice(0, 7);
  informar(86, 'Preparando el Excel');
  const excel = await generarExcel({
    banco: entrada.nombreBanco,
    moneda: entrada.moneda,
    periodo,
    movimientosBanco: banco.movimientos,
    movimientosPlanilla: planilla.movimientos,
    resultados,
    resumen,
    cierre,
    fondos,
    reglas: entrada.reglas,
    zonaHoraria: entrada.zonaHoraria,
  });
  informar(100, 'Conciliación lista');
  const avisos = [
    banco.filasExcluidasMoneda + planilla.filasExcluidasMoneda > 0
      ? `${banco.filasExcluidasMoneda + planilla.filasExcluidasMoneda} filas quedaron fuera por moneda`
      : '',
    banco.errores.length + planilla.errores.length > 0
      ? `${banco.errores.length + planilla.errores.length} filas no se pudieron interpretar`
      : '',
  ].filter(Boolean);
  return {
    nombreBanco: entrada.nombreBanco,
    moneda: entrada.moneda,
    periodo,
    movimientosBanco: banco.movimientos,
    movimientosPlanilla: planilla.movimientos,
    resultados,
    resumen,
    cierre,
    fondos,
    reglas: entrada.reglas,
    excel,
    avisos,
  };
}

export async function exportarResultado(
  datos: Omit<DatosConciliacion, 'excel' | 'avisos'>,
  zonaHoraria?: string,
): Promise<Uint8Array> {
  return generarExcel({
    banco: datos.nombreBanco,
    moneda: datos.moneda as Moneda,
    periodo: datos.periodo,
    movimientosBanco: datos.movimientosBanco,
    movimientosPlanilla: datos.movimientosPlanilla,
    resultados: datos.resultados,
    resumen: datos.resumen,
    cierre: datos.cierre,
    fondos: datos.fondos,
    reglas: datos.reglas as Regla[],
    zonaHoraria,
  });
}
