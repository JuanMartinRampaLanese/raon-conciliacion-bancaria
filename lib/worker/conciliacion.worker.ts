/// <reference lib="webworker" />

import type { RespuestaWorker, SolicitudWorker } from '@/lib/worker/protocolo';
import { exportarResultado, previsualizarArchivo, procesarConciliacion } from '@/lib/worker/procesar';

const contexto = self as DedicatedWorkerGlobalScope;

function responder(respuesta: RespuestaWorker): void {
  contexto.postMessage(respuesta);
}

contexto.addEventListener('message', (evento: MessageEvent<SolicitudWorker>) => {
  void (async () => {
    try {
      const solicitud = evento.data;
      if (solicitud.tipo === 'previsualizar') {
        responder({ tipo: 'previsualizacion', datos: await previsualizarArchivo(solicitud.archivo) });
        return;
      }
      if (solicitud.tipo === 'exportar') {
        responder({
          tipo: 'excel',
          bytes: await exportarResultado(solicitud.datos, solicitud.zonaHoraria),
        });
        return;
      }
      responder({
        tipo: 'resultado',
        datos: await procesarConciliacion(solicitud, (porcentaje, mensaje) =>
          responder({ tipo: 'progreso', porcentaje, mensaje }),
        ),
      });
    } catch (error) {
      responder({
        tipo: 'error',
        mensaje: error instanceof Error ? error.message : 'Error inesperado al procesar los archivos',
      });
    }
  })();
});

export {};
