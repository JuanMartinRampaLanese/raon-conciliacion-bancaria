import { expect, it } from 'vitest';
import { parsearArgumentos, resolverNombreBanco } from '@/scripts/argumentos';

it('usa --nombre-banco cuando se informa y conserva el nombre del archivo como fallback', () => {
  const conNombre = parsearArgumentos([
    '--banco',
    'test-data/banco.csv',
    '--planilla',
    'test-data/planilla.csv',
    '--moneda',
    'UYU',
    '--nombre-banco',
    'BROU',
  ]);
  expect(resolverNombreBanco(conNombre)).toBe('BROU');
  expect(resolverNombreBanco({ banco: 'test-data/banco.csv' })).toBe('banco');
});
