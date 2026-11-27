import { describe, expect, it } from 'vitest';
import { crearAlmacenLocal } from '@/lib/almacen';

class AlmacenFalso {
  private datos = new Map<string, string>();
  getItem(clave: string): string | null { return this.datos.get(clave) ?? null; }
  setItem(clave: string, valor: string): void { this.datos.set(clave, valor); }
}

describe('almacén local', () => {
  it('persiste reglas y plantillas sin guardar movimientos', async () => {
    const destino = new AlmacenFalso();
    const almacen = crearAlmacenLocal(destino);
    await almacen.guardarRegla({ id: 'R1', patron: 'REF 4471', accion: 'asignar_cliente', cliente: 'Gómez', origen: 'manual' });
    await almacen.guardarPlantilla({ id: 'P1', banco: 'BROU', mapeo: { fecha: 'FECHA', descripcion: 'CONCEPTO', importe: 'MONTO' } });
    const recargado = crearAlmacenLocal(destino);
    expect((await recargado.listarReglas()).find((regla) => regla.id === 'R1')).toMatchObject({ cliente: 'Gómez' });
    expect(await recargado.listarPlantillas()).toEqual([{ id: 'P1', banco: 'BROU', mapeo: { fecha: 'FECHA', descripcion: 'CONCEPTO', importe: 'MONTO' } }]);
    expect(JSON.stringify(destino)).not.toContain('movimientos');
  });

  it('sigue funcionando cuando localStorage arroja errores', async () => {
    const bloqueado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    const almacen = crearAlmacenLocal(bloqueado);
    await expect(almacen.listarReglas()).resolves.not.toHaveLength(0);
    await expect(almacen.guardarRegla({ id: 'R2', patron: 'TEST', accion: 'gasto_bancario', origen: 'manual' })).resolves.toBeUndefined();
  });
});
