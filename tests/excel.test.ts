import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import type { Movimiento, Regla, Resultado, Resumen } from '@/lib/dominio';
import { controlarCierre } from '@/lib/cierre';
import { generarExcel, nombreArchivoExcel, textoSugerenciaIA } from '@/lib/excel';
import { calcularSaldosPorCliente } from '@/lib/saldos';

it('describe en el Excel el candidato, confianza y motivo sugeridos por IA', () => {
  const resultado = {
    id: 'R-IA',
    estado: 'dudoso',
    banco: ['B-IA'],
    planilla: [],
    diferenciaCentavos: 0,
    puntaje: 0.8,
    nota: 'Revisar',
    sugerenciaIA: { indice: 1, confianza: 0.87, motivo: 'Coinciden monto y cliente' },
  } satisfies Resultado;
  expect(textoSugerenciaIA(resultado)).toBe(
    'Candidato 2 · 87% · Coinciden monto y cliente',
  );
  expect(textoSugerenciaIA({
    ...resultado,
    sugerenciaIA: { indice: null, confianza: 0.42, motivo: 'No hay evidencia suficiente' },
  })).toBe('Ningún candidato · 42% · No hay evidencia suficiente');
});

it('genera siete hojas, fechas reales y ningún valor fórmula', async () => {
  const banco: Movimiento[] = [
    {
      id: 'B-0001',
      origen: 'banco',
      fecha: '2026-10-01',
      descripcion: '=2+2',
      texto: '2 2',
      centavos: 10_000,
      moneda: 'UYU',
      saldoCentavos: 110_000,
      fila: 2,
    },
  ];
  const planilla: Movimiento[] = [
    {
      ...banco[0],
      id: 'P-0001',
      origen: 'planilla',
      cliente: '+CLIENTE',
      tipo: 'tercero',
      saldoCentavos: undefined,
    },
  ];
  const resultados: Resultado[] = [
    {
      id: 'R-0001',
      estado: 'conciliado',
      paso: 'exacto',
      banco: ['B-0001'],
      planilla: ['P-0001'],
      diferenciaCentavos: 0,
      puntaje: 1,
      nota: '@nota',
    },
  ];
  const resumen: Resumen = {
    cantidadBanco: 1,
    cantidadPlanilla: 1,
    conciliados: 1,
    dudosos: 0,
    soloBanco: 0,
    soloPlanilla: 0,
    gastosBancarios: 0,
    porcentajeConciliadoCantidad: 1,
    porcentajeConciliadoMonto: 1,
    totalesPorEstado: { conciliado: { cantidad: 1, centavos: 10_000 } },
  };
  const cierre = controlarCierre(banco);
  const fondos = calcularSaldosPorCliente(planilla, resultados, cierre.saldoFinalCentavos);
  const bytes = await generarExcel({
    banco: 'Banco prueba',
    moneda: 'UYU',
    periodo: '2026-10',
    movimientosBanco: banco,
    movimientosPlanilla: planilla,
    resultados,
    resumen,
    cierre,
    fondos,
    reglas: [],
    generadoEl: new Date(Date.UTC(2026, 10, 24)),
  });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes.slice().buffer);
  expect(libro.worksheets.map((hoja) => hoja.name)).toEqual([
    'Resumen',
    'Conciliados',
    'Dudosos',
    'Solo en banco',
    'Solo en planilla',
    'Saldos por cliente',
    'Reglas aplicadas',
  ]);
  expect(libro.getWorksheet('Conciliados')?.getCell('C2').value).toBeInstanceOf(Date);
  const hojaResumen = libro.getWorksheet('Resumen')!;
  const filaResumen = (indicador: string): ExcelJS.Row => {
    let encontrada: ExcelJS.Row | undefined;
    hojaResumen.eachRow((fila) => {
      if (fila.getCell(1).value === indicador) encontrada = fila;
    });
    expect(encontrada, indicador).toBeDefined();
    return encontrada!;
  };
  expect(hojaResumen.getRow(1).values).toEqual([
    undefined,
    'Indicador',
    'Valor',
    'Cantidad',
    'Monto',
  ]);
  const formatosResumen: Record<string, string | undefined> = {
    Banco: undefined,
    Moneda: undefined,
    Período: undefined,
    'Movimientos del banco': '0',
    'Movimientos de la planilla': '0',
    'Conciliado por cantidad': '0.00%',
    'Conciliado por monto': '0.00%',
    'Control de cierre': undefined,
    'Diferencia de cierre': '#,##0.00',
    'Fondos de terceros': '#,##0.00',
    'Saldo en banco': '#,##0.00',
    'Diferencia fondos/banco': '#,##0.00',
    'Generado el': 'dd/mm/yyyy hh:mm',
    Aviso: undefined,
  };
  for (const [indicador, formato] of Object.entries(formatosResumen)) {
    expect(filaResumen(indicador).getCell(2).numFmt, indicador).toBe(formato);
  }
  expect(filaResumen('Movimientos de la planilla').getCell(2).value).toBe(1);
  expect(filaResumen('Diferencia fondos/banco').getCell(2).value).toBe(1_000);
  expect(filaResumen('Generado el').getCell(2).value).toBeInstanceOf(Date);
  const totalConciliado = filaResumen('Estado: Conciliado');
  expect(totalConciliado.getCell(2).value).toBeNull();
  expect(totalConciliado.getCell(3)).toMatchObject({ value: 1, numFmt: '0' });
  expect(totalConciliado.getCell(4)).toMatchObject({ value: 100, numFmt: '#,##0.00' });
  libro.eachSheet((hoja) => {
    hoja.eachRow((fila) => {
      fila.eachCell((celda) => {
        expect(celda.type).not.toBe(ExcelJS.ValueType.Formula);
      });
    });
  });
  expect(nombreArchivoExcel('Banco Prueba', 'UYU', '2026-10')).toBe(
    'conciliacion_banco_prueba_UYU_2026-10.xlsx',
  );
});

it('cuenta solo la regla de gasto específica que realmente se aplicó', async () => {
  const banco: Movimiento[] = [
    {
      id: 'B-0001',
      origen: 'banco',
      fecha: '2026-10-01',
      descripcion: 'IVA COMISION',
      texto: 'IVA COMISION',
      centavos: -2_200,
      moneda: 'UYU',
      fila: 2,
    },
  ];
  const resultados: Resultado[] = [
    {
      id: 'R-0001',
      estado: 'gasto_bancario',
      paso: 'regla',
      banco: ['B-0001'],
      planilla: [],
      diferenciaCentavos: -2_200,
      puntaje: 1,
      nota: 'Gasto bancario detectado por la regla “IVA COMISION”',
    },
  ];
  const reglas: Regla[] = [
    {
      id: 'GENERAL',
      patron: 'COMISION',
      accion: 'gasto_bancario',
      origen: 'por_defecto',
    },
    {
      id: 'ESPECIFICA',
      patron: 'IVA COMISION',
      accion: 'gasto_bancario',
      origen: 'por_defecto',
    },
  ];
  const resumen: Resumen = {
    cantidadBanco: 1,
    cantidadPlanilla: 0,
    conciliados: 0,
    dudosos: 0,
    soloBanco: 0,
    soloPlanilla: 0,
    gastosBancarios: 1,
    porcentajeConciliadoCantidad: 0,
    porcentajeConciliadoMonto: 0,
    totalesPorEstado: { gasto_bancario: { cantidad: 1, centavos: -2_200 } },
  };
  const cierre = controlarCierre(banco);
  const bytes = await generarExcel({
    banco: 'BROU',
    moneda: 'UYU',
    periodo: '2026-10',
    movimientosBanco: banco,
    movimientosPlanilla: [],
    resultados,
    resumen,
    cierre,
    fondos: calcularSaldosPorCliente([], resultados),
    reglas,
    generadoEl: new Date(Date.UTC(2026, 10, 24)),
  });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes.slice().buffer);
  const hoja = libro.getWorksheet('Reglas aplicadas')!;
  const conteos = new Map<string, number>();
  hoja.eachRow((fila, numero) => {
    if (numero > 1) conteos.set(String(fila.getCell(1).value), Number(fila.getCell(6).value));
  });
  expect(conteos).toEqual(
    new Map([
      ['GENERAL', 0],
      ['ESPECIFICA', 1],
    ]),
  );
});

it('muestra nombres legibles para todos los estados en la hoja Resumen', async () => {
  const estados = {
    conciliado: 'Conciliado',
    conciliado_con_diferencia: 'Conciliado con diferencia',
    gasto_bancario: 'Gasto bancario',
    dudoso: 'Dudoso',
    solo_banco: 'Solo en banco',
    solo_planilla: 'Solo en planilla',
  } as const;
  const resumen: Resumen = {
    cantidadBanco: 0,
    cantidadPlanilla: 0,
    conciliados: 0,
    dudosos: 0,
    soloBanco: 0,
    soloPlanilla: 0,
    gastosBancarios: 0,
    porcentajeConciliadoCantidad: 0,
    porcentajeConciliadoMonto: 0,
    totalesPorEstado: Object.fromEntries(
      Object.keys(estados).map((estado) => [estado, { cantidad: 1, centavos: 100 }]),
    ),
  };
  const cierre = controlarCierre([]);
  const bytes = await generarExcel({
    banco: 'BROU',
    moneda: 'UYU',
    periodo: '2026-11',
    movimientosBanco: [],
    movimientosPlanilla: [],
    resultados: [],
    resumen,
    cierre,
    fondos: calcularSaldosPorCliente([], []),
    reglas: [],
  });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes.slice().buffer);
  const indicadores = new Set<string>();
  libro.getWorksheet('Resumen')!.eachRow((fila, numero) => {
    if (numero > 1) indicadores.add(String(fila.getCell(1).value));
  });
  expect([...Object.values(estados)].every((estado) => indicadores.has(`Estado: ${estado}`))).toBe(true);
  expect([...indicadores].some((indicador) => indicador.includes('conciliado_con_diferencia'))).toBe(false);
});

it('escribe Generado el con la hora local de la zona del usuario', async () => {
  const resumen: Resumen = {
    cantidadBanco: 0,
    cantidadPlanilla: 0,
    conciliados: 0,
    dudosos: 0,
    soloBanco: 0,
    soloPlanilla: 0,
    gastosBancarios: 0,
    porcentajeConciliadoCantidad: 0,
    porcentajeConciliadoMonto: 0,
    totalesPorEstado: {},
  };
  const bytes = await generarExcel({
    banco: 'BROU',
    moneda: 'UYU',
    periodo: '2026-11',
    movimientosBanco: [],
    movimientosPlanilla: [],
    resultados: [],
    resumen,
    cierre: controlarCierre([]),
    fondos: calcularSaldosPorCliente([], []),
    reglas: [],
    generadoEl: new Date('2026-11-26T15:30:00.000Z'),
    zonaHoraria: 'America/Montevideo',
  });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes.slice().buffer);
  let generadoEl: Date | undefined;
  libro.getWorksheet('Resumen')!.eachRow((fila) => {
    if (fila.getCell(1).value === 'Generado el') generadoEl = fila.getCell(2).value as Date;
  });
  expect(generadoEl?.toISOString()).toBe('2026-11-26T12:30:00.000Z');
});
