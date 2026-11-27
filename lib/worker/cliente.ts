'use client';

import type { DatosConciliacion, PrevisualizacionArchivo, RespuestaWorker, SolicitudWorker } from '@/lib/worker/protocolo';

function ejecutarWorker<T>(
  solicitud: SolicitudWorker,
  extraer: (respuesta: RespuestaWorker) => T | undefined,
  alProgresar?: (porcentaje: number, mensaje: string) => void,
): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const worker = new Worker(new URL('./conciliacion.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (evento: MessageEvent<RespuestaWorker>) => {
      const respuesta = evento.data;
      if (respuesta.tipo === 'progreso') {
        alProgresar?.(respuesta.porcentaje, respuesta.mensaje);
        return;
      }
      if (respuesta.tipo === 'error') {
        worker.terminate();
        rechazar(new Error(respuesta.mensaje));
        return;
      }
      const resultado = extraer(respuesta);
      if (resultado !== undefined) {
        worker.terminate();
        resolver(resultado);
      }
    });
    worker.addEventListener('error', () => {
      worker.terminate();
      rechazar(new Error('El navegador no pudo iniciar el procesamiento en segundo plano'));
    });
    worker.postMessage(solicitud);
  });
}

export function pedirPrevisualizacion(
  solicitud: Extract<SolicitudWorker, { tipo: 'previsualizar' }>,
): Promise<PrevisualizacionArchivo> {
  return ejecutarWorker(solicitud, (respuesta) =>
    respuesta.tipo === 'previsualizacion' ? respuesta.datos : undefined,
  );
}

export function pedirConciliacion(
  solicitud: Extract<SolicitudWorker, { tipo: 'conciliar' }>,
  alProgresar: (porcentaje: number, mensaje: string) => void,
): Promise<DatosConciliacion> {
  return ejecutarWorker(
    solicitud,
    (respuesta) => (respuesta.tipo === 'resultado' ? respuesta.datos : undefined),
    alProgresar,
  );
}

export function pedirExcel(
  solicitud: Extract<SolicitudWorker, { tipo: 'exportar' }>,
): Promise<Uint8Array> {
  return ejecutarWorker(solicitud, (respuesta) =>
    respuesta.tipo === 'excel' ? respuesta.bytes : undefined,
  );
}
