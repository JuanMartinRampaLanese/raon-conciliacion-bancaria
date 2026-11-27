import { describe, expect, it } from 'vitest';
import {
  detectarMesDia,
  normalizarFilas,
  normalizarTexto,
  parsearFecha,
  parsearMonto,
} from '@/lib/normalizar';

describe('normalización de montos', () => {
  it.each([
    ['1.234,56', 123_456],
    ['1,234.56', 123_456],
    ['1234.56', 123_456],
    ['-1.234,56', -123_456],
    ['(1.234,56)', -123_456],
    ['1.234,56-', -123_456],
    ['$ 1.234', 123_400],
    ['U$S 50,00', 5_000],
  ])('interpreta %s', (entrada, esperado) => {
    expect(parsearMonto(entrada)).toBe(esperado);
  });
});

describe('normalización de fechas', () => {
  it.each([
    ['31/10/2026', false, '2026-10-31'],
    ['31-10-26', false, '2026-10-31'],
    ['31.10.2026', false, '2026-10-31'],
    ['2026-10-31', false, '2026-10-31'],
    ['10/31/2026', true, '2026-10-31'],
    [46_326, false, '2026-10-31'],
  ])('interpreta %s', (entrada, mesDia, esperado) => {
    expect(parsearFecha(entrada, mesDia)).toBe(esperado);
  });

  it('detecta un archivo mes/día', () => {
    expect(detectarMesDia(['10/31/2026', '11/01/2026'])).toBe(true);
  });
});

it('normaliza texto, orden inverso y moneda', () => {
  const resultado = normalizarFilas({
    origen: 'banco',
    moneda: 'UYU',
    mapeo: { fecha: 'Fecha', descripcion: 'Detalle', importe: 'Monto', moneda: 'Moneda' },
    filas: [
      {
        numero: 2,
        valores: {
          Fecha: '02/10/2026',
          Detalle: '  Dépósito, José! ',
          Monto: '10,00',
          Moneda: 'UYU',
        },
      },
      {
        numero: 3,
        valores: { Fecha: '01/10/2026', Detalle: 'Pago', Monto: '-5,00', Moneda: 'UYU' },
      },
      { numero: 4, valores: { Fecha: '01/10/2026', Detalle: 'USD', Monto: '2,00', Moneda: 'USD' } },
      { numero: 5, valores: { Fecha: 'TOTAL', Detalle: '', Monto: '', Moneda: 'UYU' } },
    ],
  });
  expect(resultado.movimientos.map((m) => m.id)).toEqual(['B-0001', 'B-0002']);
  expect(resultado.movimientos[1].texto).toBe('DEPOSITO JOSE');
  expect(resultado.filasExcluidasMoneda).toBe(1);
  expect(resultado.errores).toHaveLength(0);
  expect(normalizarTexto('Árbol — S.R.L.')).toBe('ARBOL S R L');
});
