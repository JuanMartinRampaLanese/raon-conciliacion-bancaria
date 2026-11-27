import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ErrorLectura, leerArchivo } from '@/lib/lectura';

describe('lectura', () => {
  it('detecta encabezados luego de títulos y separador punto y coma', async () => {
    const csv = [
      'Extracto ficticio',
      'Cuenta 123',
      'Fecha;Descripción;Débito;Crédito;Saldo',
      '01/10/2026;Depósito;;1.000,00;1.000,00',
    ].join('\n');
    const resultado = await leerArchivo(new TextEncoder().encode(csv), 'banco.csv');
    expect(resultado.filaEncabezado).toBe(3);
    expect(resultado.mapeoDetectado).toMatchObject({
      fecha: 'Fecha',
      descripcion: 'Descripción',
      debito: 'Débito',
      credito: 'Crédito',
    });
  });

  it('lee Windows-1252 cuando no es UTF-8', async () => {
    const texto = 'Fecha;Descripci\xf3n;Monto\n01/10/2026;Dep\xf3sito;10,00';
    const bytes = Uint8Array.from([...texto].map((caracter) => caracter.charCodeAt(0)));
    const resultado = await leerArchivo(bytes, 'planilla.csv');
    expect(resultado.mapeoDetectado.descripcion).toBe('Descripción');
  });

  it('lee XLSX desde Uint8Array', async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Datos');
    hoja.addRow(['Fecha', 'Descripción', 'Importe']);
    hoja.addRow([new Date(Date.UTC(2026, 9, 1)), 'Cobro', 100]);
    const bytes = new Uint8Array(await libro.xlsx.writeBuffer());
    const resultado = await leerArchivo(bytes, 'banco.xlsx');
    expect(resultado.filas).toHaveLength(1);
    expect(resultado.mapeoDetectado.importe).toBe('Importe');
  });

  it('rechaza XLS antiguo', async () => {
    await expect(leerArchivo(new Uint8Array(), 'viejo.xls')).rejects.toThrow(ErrorLectura);
  });
});
