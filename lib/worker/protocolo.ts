import type { FilaCruda, MapeoColumnas, Moneda, Movimiento, Regla, Resultado, Resumen } from '@/lib/dominio';
import type { ControlCierre } from '@/lib/cierre';
import type { ResumenFondosTerceros } from '@/lib/saldos';

export interface ArchivoBytes {
  nombre: string;
  bytes: Uint8Array;
}

export interface PrevisualizacionArchivo {
  encabezados: string[];
  filas: FilaCruda[];
  mapeoDetectado: MapeoColumnas;
  filaEncabezado: number;
  totalFilas: number;
}

export interface DatosConciliacion {
  nombreBanco: string;
  moneda: Moneda;
  periodo: string;
  movimientosBanco: Movimiento[];
  movimientosPlanilla: Movimiento[];
  resultados: Resultado[];
  resumen: Resumen;
  cierre: ControlCierre;
  fondos: ResumenFondosTerceros;
  reglas: Regla[];
  excel: Uint8Array;
  avisos: string[];
}

export type SolicitudWorker =
  | { tipo: 'previsualizar'; archivo: ArchivoBytes }
  | {
      tipo: 'conciliar';
      banco: ArchivoBytes;
      planilla: ArchivoBytes;
      mapeoBanco: MapeoColumnas;
      mapeoPlanilla: MapeoColumnas;
      nombreBanco: string;
      moneda: Moneda;
      reglas: Regla[];
      zonaHoraria?: string;
    }
  | { tipo: 'exportar'; datos: Omit<DatosConciliacion, 'excel' | 'avisos'>; zonaHoraria?: string };

export type RespuestaWorker =
  | { tipo: 'progreso'; porcentaje: number; mensaje: string }
  | { tipo: 'previsualizacion'; datos: PrevisualizacionArchivo }
  | { tipo: 'resultado'; datos: DatosConciliacion }
  | { tipo: 'excel'; bytes: Uint8Array }
  | { tipo: 'error'; mensaje: string };
