import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import type { FilaCruda, MapeoColumnas } from '@/lib/dominio';
import { normalizarTexto } from '@/lib/normalizar';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILAS = 20_000;

const sinonimos: Record<keyof MapeoColumnas, string[]> = {
  fecha: ['FECHA', 'FEC', 'F VALOR', 'FECHA VALOR', 'FECHA OPERACION', 'DATE'],
  descripcion: ['DESCRIPCION', 'CONCEPTO', 'DETALLE', 'MOVIMIENTO', 'REFERENCIA DEL MOVIMIENTO'],
  debito: ['DEBITO', 'DEBE', 'EGRESO', 'RETIRO'],
  credito: ['CREDITO', 'HABER', 'INGRESO', 'DEPOSITO'],
  importe: ['IMPORTE', 'MONTO', 'VALOR'],
  saldo: ['SALDO'],
  cliente: ['CLIENTE', 'PROPIETARIO', 'INQUILINO', 'TITULAR', 'CASO'],
  referencia: ['REFERENCIA', 'REF', 'NRO', 'COMPROBANTE'],
  moneda: ['MONEDA', 'DIVISA'],
  tipo: ['TIPO'],
};

export class ErrorLectura extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorLectura';
  }
}

function textoCelda(valor: ExcelJS.CellValue): unknown {
  if (valor == null) return '';
  if (valor instanceof Date || typeof valor === 'number' || typeof valor === 'string') return valor;
  if (typeof valor === 'object' && 'result' in valor) return valor.result ?? '';
  if (typeof valor === 'object' && 'text' in valor) return valor.text;
  return String(valor);
}

export function detectarMapeo(encabezados: unknown[]): MapeoColumnas {
  const mapeo: MapeoColumnas = {};
  encabezados.forEach((encabezado) => {
    const original = String(encabezado ?? '').trim();
    const normalizado = normalizarTexto(original);
    for (const [campo, opciones] of Object.entries(sinonimos) as Array<
      [keyof MapeoColumnas, string[]]
    >) {
      if (!mapeo[campo] && opciones.includes(normalizado)) mapeo[campo] = original;
    }
  });
  return mapeo;
}

function puntajeEncabezado(fila: unknown[]): number {
  const mapeo = detectarMapeo(fila);
  const monto = Boolean(mapeo.importe || mapeo.debito || mapeo.credito);
  return Number(Boolean(mapeo.fecha)) + Number(Boolean(mapeo.descripcion)) + Number(monto);
}

function convertirMatriz(matriz: unknown[][]): ResultadoLectura {
  const limite = Math.min(15, matriz.length);
  let indiceEncabezado = -1;
  let mejor = 0;
  for (let indice = 0; indice < limite; indice += 1) {
    const puntaje = puntajeEncabezado(matriz[indice]);
    if (puntaje > mejor) {
      mejor = puntaje;
      indiceEncabezado = indice;
    }
  }
  if (indiceEncabezado < 0 || mejor < 2) {
    throw new ErrorLectura('No se pudo detectar la fila de encabezados en las primeras 15 filas');
  }
  const encabezados = matriz[indiceEncabezado].map((valor, indice) => {
    const texto = String(valor ?? '').trim();
    return texto || `Columna ${indice + 1}`;
  });
  const filas: FilaCruda[] = [];
  for (let indice = indiceEncabezado + 1; indice < matriz.length; indice += 1) {
    const celdas = matriz[indice];
    if (celdas.every((celda) => String(celda ?? '').trim() === '')) continue;
    const valores: Record<string, unknown> = {};
    encabezados.forEach((encabezado, columna) => {
      valores[encabezado] = celdas[columna] ?? '';
    });
    filas.push({ numero: indice + 1, valores });
    if (filas.length > MAX_FILAS)
      throw new ErrorLectura('El archivo supera el límite de 20.000 filas');
  }
  return {
    encabezados,
    filas,
    mapeoDetectado: detectarMapeo(encabezados),
    filaEncabezado: indiceEncabezado + 1,
  };
}

function decodificarCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function leerCsv(bytes: Uint8Array): ResultadoLectura {
  const texto = decodificarCsv(bytes);
  const alternativas = [',', ';'].map((delimiter) =>
    Papa.parse<string[]>(texto, { delimiter, skipEmptyLines: false }),
  );
  const resultado = alternativas.sort((a, b) => {
    const puntajeA = Math.max(...a.data.slice(0, 15).map(puntajeEncabezado));
    const puntajeB = Math.max(...b.data.slice(0, 15).map(puntajeEncabezado));
    return puntajeB - puntajeA;
  })[0];
  const errorCritico = resultado.errors.find((error) => error.code === 'MissingQuotes');
  if (errorCritico) throw new ErrorLectura(`No se pudo leer el CSV: ${errorCritico.message}`);
  return convertirMatriz(resultado.data);
}

async function leerXlsx(bytes: Uint8Array): Promise<ResultadoLectura> {
  const libro = new ExcelJS.Workbook();
  const copia = bytes.slice();
  await libro.xlsx.load(copia.buffer);
  const hoja = libro.worksheets[0];
  if (!hoja) throw new ErrorLectura('El Excel no tiene hojas');
  const matriz: unknown[][] = [];
  hoja.eachRow({ includeEmpty: true }, (fila) => {
    const celdas: unknown[] = [];
    for (let columna = 1; columna <= hoja.columnCount; columna += 1) {
      celdas.push(textoCelda(fila.getCell(columna).value));
    }
    matriz.push(celdas);
  });
  return convertirMatriz(matriz);
}

export interface ResultadoLectura {
  encabezados: string[];
  filas: FilaCruda[];
  mapeoDetectado: MapeoColumnas;
  filaEncabezado: number;
}

export async function leerArchivo(bytes: Uint8Array, nombre: string): Promise<ResultadoLectura> {
  if (bytes.byteLength > MAX_BYTES) throw new ErrorLectura('El archivo supera el límite de 10 MB');
  const extension = nombre.toLowerCase().split('.').pop();
  if (extension === 'xls') throw new ErrorLectura('Guardalo como .xlsx o .csv y volvé a subirlo');
  if (extension === 'csv') return leerCsv(bytes);
  if (extension === 'xlsx') return leerXlsx(bytes);
  throw new ErrorLectura('Formato no admitido. Usá un archivo .xlsx o .csv');
}
