import ExcelJS from 'exceljs';
import type { Estado, Moneda, Movimiento, Regla, Resultado, Resumen } from '@/lib/dominio';
import type { ControlCierre } from '@/lib/cierre';
import type { ResumenFondosTerceros } from '@/lib/saldos';
import { normalizarTexto } from '@/lib/normalizar';
import { seleccionarReglaGasto } from '@/lib/motor';

const COLOR_CABECERA = 'FF17324D';
const COLORES_ESTADO: Record<string, string> = {
  conciliado: 'FFD9EAD3',
  conciliado_con_diferencia: 'FFFFF2CC',
  dudoso: 'FFFFE599',
  solo_banco: 'FFF4CCCC',
  solo_planilla: 'FFF4CCCC',
  gasto_bancario: 'FFD9D2E9',
};

export interface EntradaExcel {
  banco: string;
  moneda: Moneda;
  periodo: string;
  movimientosBanco: Movimiento[];
  movimientosPlanilla: Movimiento[];
  resultados: Resultado[];
  resumen: Resumen;
  cierre: ControlCierre;
  fondos: ResumenFondosTerceros;
  reglas: Regla[];
  generadoEl?: Date;
  zonaHoraria?: string;
}

export const ETIQUETAS_ESTADO: Record<Estado, string> = {
  conciliado: 'Conciliado',
  conciliado_con_diferencia: 'Conciliado con diferencia',
  gasto_bancario: 'Gasto bancario',
  dudoso: 'Dudoso',
  solo_banco: 'Solo en banco',
  solo_planilla: 'Solo en planilla',
};

export function textoSugerenciaIA(resultado: Resultado): string {
  const sugerencia = resultado.sugerenciaIA;
  if (!sugerencia) return '';
  const seleccion =
    sugerencia.indice === null ? 'Ningún candidato' : `Candidato ${sugerencia.indice + 1}`;
  const confianza = new Intl.NumberFormat('es-UY', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(sugerencia.confianza);
  return `${seleccion} · ${confianza} · ${sugerencia.motivo}`;
}

export function fechaHoraLocalExcel(instante: Date, zonaHoraria?: string): Date {
  const zona = zonaHoraria || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .reduce<Record<string, string>>((acumulado, parte) => {
        acumulado[parte.type] = parte.value;
        return acumulado;
      }, {});
    return new Date(
      Date.UTC(
        Number(partes.year),
        Number(partes.month) - 1,
        Number(partes.day),
        Number(partes.hour),
        Number(partes.minute),
        Number(partes.second),
      ),
    );
  } catch {
    return new Date(
      Date.UTC(
        instante.getFullYear(),
        instante.getMonth(),
        instante.getDate(),
        instante.getHours(),
        instante.getMinutes(),
        instante.getSeconds(),
      ),
    );
  }
}

function fechaExcel(fecha: string | undefined): Date | '' {
  return fecha ? new Date(`${fecha}T00:00:00Z`) : '';
}

function textoSeguro(valor: unknown): string {
  return String(valor ?? '');
}

function prepararHoja(hoja: ExcelJS.Worksheet, encabezados: string[]): void {
  hoja.addRow(encabezados.map(textoSeguro));
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CABECERA } };
  fila.alignment = { vertical: 'middle' };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: encabezados.length } };
  hoja.columns = encabezados.map((encabezado) => ({
    width: Math.min(45, Math.max(12, encabezado.length + 3)),
  }));
}

function aplicarFormatoFilas(hoja: ExcelJS.Worksheet, columnaEstado?: number): void {
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return;
    fila.eachCell((celda) => {
      if (celda.value instanceof Date) celda.numFmt = 'dd/mm/yyyy';
      if (
        typeof celda.value === 'number' &&
        /monto|saldo|diferencia|cobrado|pagado/i.test(
          String(hoja.getRow(1).getCell(celda.col).value),
        )
      ) {
        celda.numFmt = '#,##0.00';
      }
    });
    if (columnaEstado) {
      const estado = String(fila.getCell(columnaEstado).value ?? '');
      const color = COLORES_ESTADO[estado];
      if (color) fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
  });
}

function porId(movimientos: Movimiento[]): Map<string, Movimiento> {
  return new Map(movimientos.map((movimiento) => [movimiento.id, movimiento]));
}

function agregarResumen(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Resumen');
  prepararHoja(hoja, ['Indicador', 'Valor', 'Cantidad', 'Monto']);
  const filas: Array<{
    indicador: string;
    valor: string | number | Date;
    formato?: string;
  }> = [
    { indicador: 'Banco', valor: textoSeguro(entrada.banco) },
    { indicador: 'Moneda', valor: entrada.moneda },
    { indicador: 'Período', valor: textoSeguro(entrada.periodo) },
    { indicador: 'Movimientos del banco', valor: entrada.resumen.cantidadBanco, formato: '0' },
    {
      indicador: 'Movimientos de la planilla',
      valor: entrada.resumen.cantidadPlanilla,
      formato: '0',
    },
    {
      indicador: 'Conciliado por cantidad',
      valor: entrada.resumen.porcentajeConciliadoCantidad,
      formato: '0.00%',
    },
    {
      indicador: 'Conciliado por monto',
      valor: entrada.resumen.porcentajeConciliadoMonto,
      formato: '0.00%',
    },
    { indicador: 'Control de cierre', valor: textoSeguro(entrada.cierre.mensaje) },
    {
      indicador: 'Diferencia de cierre',
      valor: (entrada.cierre.diferenciaCentavos ?? 0) / 100,
      formato: '#,##0.00',
    },
    {
      indicador: 'Fondos de terceros',
      valor: entrada.fondos.totalTercerosCentavos / 100,
      formato: '#,##0.00',
    },
    {
      indicador: 'Saldo en banco',
      valor: (entrada.fondos.saldoBancoCentavos ?? 0) / 100,
      formato: '#,##0.00',
    },
    {
      indicador: 'Diferencia fondos/banco',
      valor: (entrada.fondos.diferenciaCentavos ?? 0) / 100,
      formato: '#,##0.00',
    },
    {
      indicador: 'Generado el',
      valor: fechaHoraLocalExcel(entrada.generadoEl ?? new Date(), entrada.zonaHoraria),
      formato: 'dd/mm/yyyy hh:mm',
    },
    {
      indicador: 'Aviso',
      valor: 'Revisar antes de usar estos resultados para hacer pagos',
    },
  ];
  for (const { indicador, valor, formato } of filas) {
    const fila = hoja.addRow([textoSeguro(indicador), valor]);
    if (formato) fila.getCell(2).numFmt = formato;
  }
  for (const [estado, total] of Object.entries(entrada.resumen.totalesPorEstado)) {
    const fila = hoja.addRow([
      `Estado: ${ETIQUETAS_ESTADO[estado as Estado]}`,
      null,
      total?.cantidad ?? 0,
      (total?.centavos ?? 0) / 100,
    ]);
    fila.getCell(3).numFmt = '0';
    fila.getCell(4).numFmt = '#,##0.00';
  }
  hoja.columns[0].width = 38;
  hoja.columns[1].width = 62;
  hoja.columns[2].width = 12;
  hoja.columns[3].width = 18;
}

function agregarConciliados(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Conciliados');
  prepararHoja(hoja, [
    'Estado',
    'Paso',
    'Fecha banco',
    'Descripción banco',
    'Monto banco',
    'Fecha planilla',
    'Descripción planilla',
    'Cliente',
    'Monto planilla',
    'Diferencia',
    'Nota',
    'Filas banco',
    'Filas planilla',
  ]);
  const banco = porId(entrada.movimientosBanco);
  const planilla = porId(entrada.movimientosPlanilla);
  for (const resultado of entrada.resultados.filter((r) =>
    ['conciliado', 'conciliado_con_diferencia'].includes(r.estado),
  )) {
    const bs = resultado.banco
      .map((id) => banco.get(id))
      .filter((m): m is Movimiento => Boolean(m));
    const ps = resultado.planilla
      .map((id) => planilla.get(id))
      .filter((m): m is Movimiento => Boolean(m));
    hoja.addRow([
      resultado.estado,
      resultado.paso ?? '',
      fechaExcel(bs[0]?.fecha),
      textoSeguro(bs.map((m) => m.descripcion).join(' | ')),
      bs.reduce((t, m) => t + m.centavos, 0) / 100,
      fechaExcel(ps[0]?.fecha),
      textoSeguro(ps.map((m) => m.descripcion).join(' | ')),
      textoSeguro([...new Set(ps.map((m) => m.cliente).filter(Boolean))].join(' | ')),
      ps.reduce((t, m) => t + m.centavos, 0) / 100,
      resultado.diferenciaCentavos / 100,
      textoSeguro(resultado.nota),
      textoSeguro(bs.map((m) => m.fila).join(', ')),
      textoSeguro(ps.map((m) => m.fila).join(', ')),
    ]);
  }
  aplicarFormatoFilas(hoja, 1);
}

function agregarDudosos(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Dudosos');
  prepararHoja(hoja, [
    'Movimiento banco',
    'Fecha',
    'Descripción',
    'Monto',
    'Candidato',
    'Puntaje',
    'Motivo',
    'Sugerencia IA',
  ]);
  const banco = porId(entrada.movimientosBanco);
  const planilla = porId(entrada.movimientosPlanilla);
  for (const resultado of entrada.resultados.filter((r) => r.estado === 'dudoso')) {
    const b = banco.get(resultado.banco[0]);
    for (const candidato of resultado.candidatos ?? []) {
      const ps = candidato.planilla
        .map((id) => planilla.get(id))
        .filter((m): m is Movimiento => Boolean(m));
      hoja.addRow([
        textoSeguro(b?.id),
        fechaExcel(b?.fecha),
        textoSeguro(b?.descripcion),
        (b?.centavos ?? 0) / 100,
        textoSeguro(ps.map((m) => `${m.id}: ${m.descripcion}`).join(' | ')),
        candidato.puntaje,
        textoSeguro(candidato.motivo),
        textoSeguro(textoSugerenciaIA(resultado)),
      ]);
    }
  }
  hoja.getColumn(6).numFmt = '0.00%';
  aplicarFormatoFilas(hoja);
}

function agregarSoloBanco(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Solo en banco');
  prepararHoja(hoja, ['Estado', 'Fecha', 'Descripción', 'Monto', 'Nota', 'Fila original']);
  const banco = porId(entrada.movimientosBanco);
  for (const resultado of entrada.resultados.filter((r) =>
    ['solo_banco', 'gasto_bancario'].includes(r.estado),
  )) {
    const movimiento = banco.get(resultado.banco[0]);
    hoja.addRow([
      resultado.estado,
      fechaExcel(movimiento?.fecha),
      textoSeguro(movimiento?.descripcion),
      (movimiento?.centavos ?? 0) / 100,
      textoSeguro(resultado.nota),
      movimiento?.fila ?? '',
    ]);
  }
  aplicarFormatoFilas(hoja, 1);
}

function agregarSoloPlanilla(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Solo en planilla');
  prepararHoja(hoja, ['Fecha', 'Descripción', 'Cliente', 'Monto', 'Sugerencia', 'Fila original']);
  const planilla = porId(entrada.movimientosPlanilla);
  for (const resultado of entrada.resultados.filter((r) => r.estado === 'solo_planilla')) {
    const movimiento = planilla.get(resultado.planilla[0]);
    hoja.addRow([
      fechaExcel(movimiento?.fecha),
      textoSeguro(movimiento?.descripcion),
      textoSeguro(movimiento?.cliente),
      (movimiento?.centavos ?? 0) / 100,
      textoSeguro(resultado.nota),
      movimiento?.fila ?? '',
    ]);
  }
  aplicarFormatoFilas(hoja);
}

function agregarSaldos(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Saldos por cliente');
  prepararHoja(hoja, ['Cliente', 'Cobrado', 'Pagado', 'Saldo', 'Conciliado', 'Pendiente']);
  for (const cliente of entrada.fondos.clientes) {
    hoja.addRow([
      textoSeguro(cliente.cliente),
      cliente.cobradoCentavos / 100,
      cliente.pagadoCentavos / 100,
      cliente.saldoCentavos / 100,
      cliente.conciliadoCentavos / 100,
      cliente.pendienteCentavos / 100,
    ]);
  }
  aplicarFormatoFilas(hoja);
}

function agregarReglas(libro: ExcelJS.Workbook, entrada: EntradaExcel): void {
  const hoja = libro.addWorksheet('Reglas aplicadas');
  prepararHoja(hoja, ['ID', 'Patrón', 'Acción', 'Cliente', 'Origen', 'Movimientos tocados']);
  const aplicaciones = new Map(entrada.reglas.map((regla) => [regla.id, 0]));
  const reglasAsignacion = entrada.reglas
    .filter((regla) => regla.accion === 'asignar_cliente' && regla.cliente)
    .map((regla) => ({ regla, patron: normalizarTexto(regla.patron) }));
  for (const movimiento of entrada.movimientosBanco) {
    const asignacion = reglasAsignacion.find(({ patron }) => movimiento.texto.includes(patron));
    if (asignacion) {
      aplicaciones.set(asignacion.regla.id, (aplicaciones.get(asignacion.regla.id) ?? 0) + 1);
    }
  }
  const idsGastos = new Set(
    entrada.resultados
      .filter((resultado) => resultado.estado === 'gasto_bancario')
      .flatMap((resultado) => resultado.banco),
  );
  for (const movimiento of entrada.movimientosBanco.filter((item) => idsGastos.has(item.id))) {
    const regla = seleccionarReglaGasto(movimiento, entrada.reglas);
    if (regla) aplicaciones.set(regla.id, (aplicaciones.get(regla.id) ?? 0) + 1);
  }
  for (const regla of entrada.reglas) {
    hoja.addRow([
      textoSeguro(regla.id),
      textoSeguro(regla.patron),
      regla.accion,
      textoSeguro(regla.cliente),
      regla.origen,
      aplicaciones.get(regla.id) ?? 0,
    ]);
  }
}

export async function generarExcel(entrada: EntradaExcel): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'RAON';
  libro.created = entrada.generadoEl ?? new Date();
  agregarResumen(libro, entrada);
  agregarConciliados(libro, entrada);
  agregarDudosos(libro, entrada);
  agregarSoloBanco(libro, entrada);
  agregarSoloPlanilla(libro, entrada);
  agregarSaldos(libro, entrada);
  agregarReglas(libro, entrada);
  const buffer = await libro.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export function nombreArchivoExcel(banco: string, moneda: Moneda, periodo: string): string {
  const bancoSeguro = normalizarTexto(banco).toLowerCase().replace(/\s+/g, '_') || 'banco';
  return `conciliacion_${bancoSeguro}_${moneda}_${periodo}.xlsx`;
}
