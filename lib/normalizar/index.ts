import type { FilaCruda, MapeoColumnas, Moneda, Movimiento, Origen } from '@/lib/dominio';

const MILISEGUNDOS_DIA = 86_400_000;

export class ErrorNormalizacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorNormalizacion';
  }
}

export function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parsearMonto(valor: unknown): number {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new ErrorNormalizacion('El monto no es un número válido');
    return Math.round(valor * 100);
  }

  let texto = String(valor ?? '').trim();
  if (!texto) throw new ErrorNormalizacion('El monto está vacío');

  let negativo = false;
  if (/^\(.*\)$/.test(texto)) {
    negativo = true;
    texto = texto.slice(1, -1);
  }
  if (texto.endsWith('-')) {
    negativo = true;
    texto = texto.slice(0, -1);
  }
  if (texto.startsWith('-')) {
    negativo = true;
    texto = texto.slice(1);
  }

  texto = texto.replace(/U\$S|USD|UYU|ARS|EUR|\$/gi, '').replace(/\s/g, '');
  if (!/^[0-9.,]+$/.test(texto)) throw new ErrorNormalizacion(`Monto inválido: ${String(valor)}`);

  const ultimaComa = texto.lastIndexOf(',');
  const ultimoPunto = texto.lastIndexOf('.');
  let separadorDecimal: ',' | '.' | undefined;

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    separadorDecimal = ultimaComa > ultimoPunto ? ',' : '.';
  } else {
    const separador = ultimaComa >= 0 ? ',' : ultimoPunto >= 0 ? '.' : undefined;
    if (separador) {
      const apariciones = texto.split(separador).length - 1;
      const decimales = texto.length - texto.lastIndexOf(separador) - 1;
      if (apariciones === 1 && decimales !== 3) separadorDecimal = separador;
      if (apariciones > 1 && decimales <= 2) separadorDecimal = separador;
    }
  }

  let enteros: string;
  let decimales = '';
  if (separadorDecimal) {
    const indice = texto.lastIndexOf(separadorDecimal);
    enteros = texto.slice(0, indice).replace(/[.,]/g, '');
    decimales = texto.slice(indice + 1);
  } else {
    enteros = texto.replace(/[.,]/g, '');
  }

  if (!enteros || decimales.length > 2) {
    throw new ErrorNormalizacion(`Monto inválido: ${String(valor)}`);
  }
  const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(centavos)) throw new ErrorNormalizacion('El monto es demasiado grande');
  return negativo ? -centavos : centavos;
}

function fechaIso(anio: number, mes: number, dia: number): string {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw new ErrorNormalizacion('La fecha no existe');
  }
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function detectarMesDia(valores: unknown[]): boolean {
  for (const valor of valores) {
    if (typeof valor !== 'string') continue;
    const partes = valor.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
    if (partes && Number(partes[2]) > 12 && Number(partes[1]) <= 12) return true;
  }
  return false;
}

export function parsearFecha(valor: unknown, mesDia = false): string {
  if (valor instanceof Date) {
    return fechaIso(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 1)
      throw new ErrorNormalizacion('Serie de Excel inválida');
    const dias = Math.floor(valor - 25_569);
    const fecha = new Date(dias * MILISEGUNDOS_DIA);
    return fechaIso(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate());
  }

  const texto = String(valor ?? '').trim();
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return fechaIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const partes = texto.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!partes) throw new ErrorNormalizacion(`Fecha inválida: ${texto}`);
  const primero = Number(partes[1]);
  const segundo = Number(partes[2]);
  const anioCorto = Number(partes[3]);
  const anio = partes[3].length === 2 ? 2000 + anioCorto : anioCorto;
  return fechaIso(anio, mesDia ? primero : segundo, mesDia ? segundo : primero);
}

function valor(fila: FilaCruda, columna: string | undefined): unknown {
  return columna ? fila.valores[columna] : undefined;
}

function monedaDe(valorCrudo: unknown, predeterminada: Moneda): Moneda {
  const texto = normalizarTexto(valorCrudo);
  if (!texto) return predeterminada;
  if (texto === 'US' || texto === 'U S' || texto === 'DOLARES') return 'USD';
  if (texto === 'PESOS' || texto === 'PESOS URUGUAYOS') return 'UYU';
  if (['UYU', 'USD', 'ARS', 'EUR'].includes(texto)) return texto as Moneda;
  return predeterminada;
}

export interface ResultadoNormalizacion {
  movimientos: Movimiento[];
  filasExcluidasMoneda: number;
  errores: Array<{ fila: number; mensaje: string }>;
}

export function normalizarFilas(entrada: {
  filas: FilaCruda[];
  mapeo: MapeoColumnas;
  origen: Origen;
  moneda: Moneda;
}): ResultadoNormalizacion {
  const { filas, mapeo, origen, moneda } = entrada;
  if (!mapeo.fecha || !mapeo.descripcion || (!mapeo.importe && !mapeo.debito && !mapeo.credito)) {
    throw new ErrorNormalizacion('Faltan columnas obligatorias: fecha, descripción y monto');
  }
  const mesDia = detectarMesDia(filas.map((fila) => valor(fila, mapeo.fecha)));
  const movimientos: Movimiento[] = [];
  const errores: Array<{ fila: number; mensaje: string }> = [];
  let filasExcluidasMoneda = 0;

  for (const fila of filas) {
    const fechaCruda = valor(fila, mapeo.fecha);
    const etiquetaFecha = normalizarTexto(fechaCruda);
    if (!etiquetaFecha || etiquetaFecha === 'TOTAL' || etiquetaFecha === 'TOTALES') continue;
    try {
      const fecha = parsearFecha(fechaCruda, mesDia);
      const monedaFila = monedaDe(valor(fila, mapeo.moneda), moneda);
      if (monedaFila !== moneda) {
        filasExcluidasMoneda += 1;
        continue;
      }
      let centavos: number;
      if (mapeo.importe) {
        centavos = parsearMonto(valor(fila, mapeo.importe));
      } else {
        const creditoCrudo = valor(fila, mapeo.credito);
        const debitoCrudo = valor(fila, mapeo.debito);
        const credito =
          creditoCrudo === '' || creditoCrudo == null ? 0 : Math.abs(parsearMonto(creditoCrudo));
        const debito =
          debitoCrudo === '' || debitoCrudo == null ? 0 : Math.abs(parsearMonto(debitoCrudo));
        centavos = credito - debito;
      }
      const descripcion = String(valor(fila, mapeo.descripcion) ?? '').trim();
      const cliente = String(valor(fila, mapeo.cliente) ?? '').trim() || undefined;
      const tipoCrudo = normalizarTexto(valor(fila, mapeo.tipo));
      const tipo =
        tipoCrudo === 'PROPIO'
          ? 'propio'
          : tipoCrudo === 'TERCERO'
            ? 'tercero'
            : cliente
              ? 'tercero'
              : 'propio';
      const saldoCrudo = valor(fila, mapeo.saldo);
      movimientos.push({
        id: '',
        origen,
        fecha,
        descripcion,
        texto: normalizarTexto(descripcion),
        centavos,
        moneda,
        cliente,
        referencia: String(valor(fila, mapeo.referencia) ?? '').trim() || undefined,
        tipo: origen === 'planilla' ? tipo : undefined,
        saldoCentavos:
          origen === 'banco' && saldoCrudo !== '' && saldoCrudo != null
            ? parsearMonto(saldoCrudo)
            : undefined,
        fila: fila.numero,
      });
    } catch (error) {
      errores.push({
        fila: fila.numero,
        mensaje: error instanceof Error ? error.message : 'Fila inválida',
      });
    }
  }

  if (movimientos.length > 1 && movimientos[0].fecha > movimientos[movimientos.length - 1].fecha) {
    movimientos.reverse();
  }
  movimientos.forEach((movimiento, indice) => {
    movimiento.id = `${origen === 'banco' ? 'B' : 'P'}-${String(indice + 1).padStart(4, '0')}`;
  });
  return { movimientos, filasExcluidasMoneda, errores };
}

export function diferenciaDias(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / MILISEGUNDOS_DIA;
}
