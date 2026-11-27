import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { interpretarFilas } from '@/lib/vista-previa';
import { previsualizarArchivo, procesarConciliacion } from '@/lib/worker/procesar';
import { REGLAS_GASTOS_PREDETERMINADAS } from '@/lib/motor';

async function bytes(ruta: string): Promise<Uint8Array> {
  const contenido = await readFile(resolve(ruta));
  return new Uint8Array(contenido.buffer, contenido.byteOffset, contenido.byteLength);
}

describe('Fase 2', () => {
  it('muestra valores crudos junto con fecha y monto interpretados', () => {
    const filas = interpretarFilas({
      filas: [{ numero: 2, valores: { Fecha: '24/11/2026', Detalle: 'Cobro', Monto: '1.234,56' } }],
      mapeo: { fecha: 'Fecha', descripcion: 'Detalle', importe: 'Monto' },
      origen: 'banco',
      moneda: 'UYU',
    });
    expect(filas[0]).toMatchObject({ fechaCruda: '24/11/2026', montoCrudo: '1.234,56', fecha: '2026-11-24', centavos: 123_456 });
  });

  it('identifica si el monto crudo viene de débito o crédito', () => {
    const base = {
      mapeo: { fecha: 'Fecha', descripcion: 'Detalle', debito: 'Débito', credito: 'Crédito' },
      origen: 'banco' as const,
      moneda: 'UYU' as const,
    };
    const filas = interpretarFilas({
      ...base,
      filas: [
        { numero: 2, valores: { Fecha: '24/11/2026', Detalle: 'Cobro', Débito: '', Crédito: '10.010,00' } },
        { numero: 3, valores: { Fecha: '25/11/2026', Detalle: 'Pago', Débito: '1.000,00', Crédito: '' } },
      ],
    });
    expect(filas.map((fila) => fila.montoCrudo)).toEqual([
      'Crédito 10.010,00',
      'Débito 1.000,00',
    ]);
  });

  it('pasa los saldos manuales al control de cierre cuando no hay columna de saldo', async () => {
    const codificar = (texto: string) => new TextEncoder().encode(texto);
    const resultado = await procesarConciliacion({
      tipo: 'conciliar',
      banco: {
        nombre: 'banco-sin-saldo.csv',
        bytes: codificar('Fecha;Descripcion;Importe\n01/10/2026;Cobro;100,00'),
      },
      planilla: {
        nombre: 'planilla.csv',
        bytes: codificar(
          'Fecha;Descripcion;Importe;Cliente;Tipo\n01/10/2026;Cobro;100,00;Cliente;tercero',
        ),
      },
      mapeoBanco: { fecha: 'Fecha', descripcion: 'Descripcion', importe: 'Importe' },
      mapeoPlanilla: {
        fecha: 'Fecha',
        descripcion: 'Descripcion',
        importe: 'Importe',
        cliente: 'Cliente',
        tipo: 'Tipo',
      },
      nombreBanco: 'Banco sin saldo',
      moneda: 'UYU',
      reglas: [],
      saldosManuales: { inicialCentavos: 5_000, finalCentavos: 15_000 },
      zonaHoraria: 'America/Montevideo',
    });
    expect(resultado.cierre).toMatchObject({
      verificado: true,
      cierra: true,
      saldoInicialCentavos: 5_000,
      saldoFinalCentavos: 15_000,
    });
  });

  it('ejecuta lectura, motor y Excel con progreso fuera de la interfaz', async () => {
    const banco = { nombre: 'banco.csv', bytes: await bytes('public/demo/banco.csv') };
    const planilla = { nombre: 'planilla.csv', bytes: await bytes('public/demo/planilla.csv') };
    const [vistaBanco, vistaPlanilla] = await Promise.all([previsualizarArchivo(banco), previsualizarArchivo(planilla)]);
    const progresos: number[] = [];
    const resultado = await procesarConciliacion({
      tipo: 'conciliar',
      banco,
      planilla,
      mapeoBanco: vistaBanco.mapeoDetectado,
      mapeoPlanilla: vistaPlanilla.mapeoDetectado,
      nombreBanco: 'Banco demo',
      moneda: 'UYU',
      reglas: REGLAS_GASTOS_PREDETERMINADAS,
      zonaHoraria: 'America/Montevideo',
    }, (porcentaje) => progresos.push(porcentaje));
    expect(progresos).toEqual([8, 30, 55, 72, 86, 100]);
    expect(resultado.resultados.length).toBeGreaterThan(0);
    expect(resultado.excel.byteLength).toBeGreaterThan(1_000);
  });
});
