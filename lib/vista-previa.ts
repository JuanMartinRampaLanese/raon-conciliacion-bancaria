import type { FilaCruda, MapeoColumnas, Moneda, Origen } from '@/lib/dominio';
import { normalizarFilas } from '@/lib/normalizar';

export interface FilaInterpretada {
  fila: number;
  fechaCruda: unknown;
  montoCrudo: unknown;
  fecha?: string;
  centavos?: number;
  error?: string;
}

function valor(fila: FilaCruda, columna: string | undefined): unknown {
  return columna ? fila.valores[columna] : '';
}

export function interpretarFilas(entrada: {
  filas: FilaCruda[];
  mapeo: MapeoColumnas;
  origen: Origen;
  moneda: Moneda;
}): FilaInterpretada[] {
  return entrada.filas.slice(0, 10).map((fila) => {
    const montoCrudo = entrada.mapeo.importe
      ? valor(fila, entrada.mapeo.importe)
      : `${String(valor(fila, entrada.mapeo.debito) ?? '')} / ${String(
          valor(fila, entrada.mapeo.credito) ?? '',
        )}`;
    try {
      const resultado = normalizarFilas({ ...entrada, filas: [fila] });
      const movimiento = resultado.movimientos[0];
      if (!movimiento) {
        return {
          fila: fila.numero,
          fechaCruda: valor(fila, entrada.mapeo.fecha),
          montoCrudo,
          error: resultado.errores[0]?.mensaje ?? 'La fila no produce un movimiento',
        };
      }
      return {
        fila: fila.numero,
        fechaCruda: valor(fila, entrada.mapeo.fecha),
        montoCrudo,
        fecha: movimiento.fecha,
        centavos: movimiento.centavos,
      };
    } catch (error) {
      return {
        fila: fila.numero,
        fechaCruda: valor(fila, entrada.mapeo.fecha),
        montoCrudo,
        error: error instanceof Error ? error.message : 'No se pudo interpretar la fila',
      };
    }
  });
}
