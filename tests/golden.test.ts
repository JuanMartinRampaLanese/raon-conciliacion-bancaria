import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { MapeoColumnas } from '@/lib/dominio';
import { controlarCierre } from '@/lib/cierre';
import { leerArchivo } from '@/lib/lectura';
import { conciliar, REGLAS_GASTOS_PREDETERMINADAS } from '@/lib/motor';
import { normalizarFilas } from '@/lib/normalizar';

async function bytes(ruta: string): Promise<Uint8Array> {
  const contenido = await readFile(ruta);
  return new Uint8Array(contenido.buffer, contenido.byteOffset, contenido.byteLength);
}

async function cargar(rutaBanco = 'test-data/banco.csv') {
  const [lecturaBanco, lecturaPlanilla] = await Promise.all([
    leerArchivo(await bytes(rutaBanco), rutaBanco),
    leerArchivo(await bytes('test-data/planilla.csv'), 'planilla.csv'),
  ]);
  const banco = normalizarFilas({
    filas: lecturaBanco.filas,
    mapeo: lecturaBanco.mapeoDetectado,
    origen: 'banco',
    moneda: 'UYU',
  });
  const planilla = normalizarFilas({
    filas: lecturaPlanilla.filas,
    mapeo: lecturaPlanilla.mapeoDetectado as MapeoColumnas,
    origen: 'planilla',
    moneda: 'UYU',
  });
  return { banco, planilla };
}

describe('datos integrales', () => {
  it('coincide con esperado.json escrito por intención', async () => {
    const { banco, planilla } = await cargar();
    const esperado = JSON.parse(await readFile('test-data/esperado.json', 'utf8')) as {
      banco: Record<string, { estado: string; planilla: string[] }>;
      planilla: Record<string, { estado: string; banco: string[] }>;
    };
    const resultado = conciliar({
      banco: banco.movimientos,
      planilla: planilla.movimientos,
      reglas: [
        ...REGLAS_GASTOS_PREDETERMINADAS,
        {
          id: 'REF',
          patron: 'REF 4471',
          accion: 'asignar_cliente',
          cliente: 'Gómez',
          origen: 'manual',
        },
      ],
    });
    for (const [id, intencion] of Object.entries(esperado.banco)) {
      const obtenido = resultado.resultados.find((r) => r.banco.includes(id));
      expect(obtenido, id).toBeDefined();
      expect(obtenido?.estado, id).toBe(intencion.estado);
      expect(obtenido?.planilla, id).toEqual(intencion.planilla);
    }
    for (const [id, intencion] of Object.entries(esperado.planilla)) {
      const obtenido = resultado.resultados.find((r) => r.planilla.includes(id));
      expect(obtenido, id).toBeDefined();
      expect(obtenido?.estado, id).toBe(intencion.estado);
      expect(obtenido?.banco, id).toEqual(intencion.banco);
    }
    const pagoParcial = resultado.resultados.find((r) => r.banco.includes('B-0059'));
    expect(
      pagoParcial?.candidatos?.find((candidato) => candidato.planilla.includes('P-0060'))?.motivo,
    ).toContain('Posible pago parcial: faltan $');
    expect(banco.filasExcluidasMoneda).toBe(1);
    expect(planilla.filasExcluidasMoneda).toBe(1);
    expect(controlarCierre(banco.movimientos).cierra).toBe(true);
  });

  it('detecta el extracto con una fila faltante', async () => {
    const { banco } = await cargar('test-data/banco_saldo_roto.csv');
    const cierre = controlarCierre(banco.movimientos);
    expect(cierre.cierra).toBe(false);
    expect(cierre.cortes.length).toBeGreaterThan(0);
  });

  it('normaliza el XLSX invertido al mismo orden', async () => {
    const lectura = await leerArchivo(
      await bytes('test-data/banco_formato_b.xlsx'),
      'banco_formato_b.xlsx',
    );
    const banco = normalizarFilas({
      filas: lectura.filas,
      mapeo: lectura.mapeoDetectado,
      origen: 'banco',
      moneda: 'UYU',
    });
    expect(banco.movimientos[0].fecha).toBe('2026-10-01');
    expect(banco.movimientos.at(-1)?.fecha).toBe('2026-10-29');
  });
});
