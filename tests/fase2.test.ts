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
