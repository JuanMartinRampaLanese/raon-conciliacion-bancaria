import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Movimiento } from '@/lib/dominio';
import { revocarUrlConDemora } from '@/lib/descarga';
import { CAMPOS_MAPEO } from '@/lib/mapeo';
import { clientesUnicos, formatearFechaPantalla } from '@/lib/presentacion';

function movimiento(id: string, cliente?: string): Movimiento {
  return {
    id,
    origen: 'planilla',
    fecha: '2026-10-01',
    descripcion: id,
    texto: id,
    centavos: 100,
    moneda: 'UYU',
    cliente,
    fila: 1,
  };
}

describe('presentación de las correcciones de Fase 2', () => {
  afterEach(() => vi.useRealTimers());

  it('formatea fechas ISO como dd/mm/aaaa sin reinterpretar la zona horaria', () => {
    expect(formatearFechaPantalla('2026-10-01')).toBe('01/10/2026');
    expect(formatearFechaPantalla(undefined)).toBe('—');
    expect(formatearFechaPantalla('texto')).toBe('texto');
  });

  it('muestra cada cliente una sola vez', () => {
    expect(
      clientesUnicos([
        movimiento('P-1', 'Foxtrot'),
        movimiento('P-2', 'Foxtrot'),
        movimiento('P-3', 'Hotel'),
      ]),
    ).toBe('Foxtrot, Hotel');
  });

  it('comparte las etiquetas legibles del mapeo con las plantillas', () => {
    expect(CAMPOS_MAPEO.find(({ clave }) => clave === 'descripcion')?.etiqueta).toBe('Descripción');
    expect(CAMPOS_MAPEO.find(({ clave }) => clave === 'debito')?.etiqueta).toBe('Débito');
  });

  it('revoca la URL después de un margen para no cancelar la descarga', () => {
    vi.useFakeTimers();
    const revocar = vi.fn();
    revocarUrlConDemora('blob:excel', revocar);
    expect(revocar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(revocar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revocar).toHaveBeenCalledWith('blob:excel');
  });
});
