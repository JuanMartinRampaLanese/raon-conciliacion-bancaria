import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import type { Movimiento, Resultado, Resumen } from '@/lib/dominio';
import { controlarCierre } from '@/lib/cierre';
import { generarExcel, nombreArchivoExcel } from '@/lib/excel';
import { calcularSaldosPorCliente } from '@/lib/saldos';

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
