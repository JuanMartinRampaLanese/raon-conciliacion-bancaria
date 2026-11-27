import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('fuerza una versión corregida de uuid dentro de ExcelJS', async () => {
  const paquete = JSON.parse(await readFile('package.json', 'utf8')) as {
    overrides?: { exceljs?: { uuid?: string } };
  };
  expect(paquete.overrides?.exceljs?.uuid).toBe('^11.1.1');
});
