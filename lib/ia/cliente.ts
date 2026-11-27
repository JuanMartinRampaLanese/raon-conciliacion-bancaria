import { respuestaIAEsquema, solicitudIAEsquema, type MovimientoIA } from '@/lib/ia/esquemas';
import type { Movimiento, Resultado } from '@/lib/dominio';
import type { DatosConciliacion } from '@/lib/worker/protocolo';

function movimientoMinimo(movimiento: Movimiento): MovimientoIA {
  return {
    fecha: movimiento.fecha,
    descripcion: movimiento.descripcion,
    montoCentavos: movimiento.centavos,
    ...(movimiento.cliente ? { cliente: movimiento.cliente } : {}),
  };
}

export function crearSolicitudIA(datos: DatosConciliacion): {
  cuerpo: ReturnType<typeof solicitudIAEsquema.parse>;
  resultadoIds: string[];
} | null {
  const banco = new Map(datos.movimientosBanco.map((movimiento) => [movimiento.id, movimiento]));
  const planilla = new Map(
    datos.movimientosPlanilla.map((movimiento) => [movimiento.id, movimiento]),
  );
  const pares = datos.resultados
    .filter((resultado) => resultado.estado === 'dudoso')
    .slice(0, 50)
    .map((resultado) => {
      const movimientoBanco = banco.get(resultado.banco[0]);
      const candidatos = (resultado.candidatos ?? []).slice(0, 3).flatMap((candidato) => {
        const movimientos = candidato.planilla
          .map((id) => planilla.get(id))
          .filter((movimiento): movimiento is Movimiento => Boolean(movimiento))
          .slice(0, 5);
        return movimientos.length > 0 ? [{ planilla: movimientos.map(movimientoMinimo) }] : [];
      });
      return movimientoBanco && candidatos.length > 0
        ? { id: resultado.id, dudoso: { banco: movimientoMinimo(movimientoBanco), candidatos } }
        : null;
    })
    .filter((par): par is NonNullable<typeof par> => Boolean(par));
  if (pares.length === 0) return null;
  return {
    cuerpo: solicitudIAEsquema.parse({ dudosos: pares.map((par) => par.dudoso) }),
    resultadoIds: pares.map((par) => par.id),
  };
}

export function incorporarSugerenciasIA(
  resultados: Resultado[],
  resultadoIds: string[],
  salida: unknown,
): Resultado[] {
  const validacion = respuestaIAEsquema.safeParse(salida);
  if (!validacion.success || validacion.data.sugerencias.length !== resultadoIds.length) {
    return resultados;
  }
  const sugerencias = new Map(
    resultadoIds.map((id, indice) => [id, validacion.data.sugerencias[indice]]),
  );
  return resultados.map((resultado) => {
    const sugerencia = sugerencias.get(resultado.id);
    if (!sugerencia || resultado.estado !== 'dudoso') return resultado;
    if (sugerencia.indice !== null && sugerencia.indice >= (resultado.candidatos?.length ?? 0)) {
      return resultado;
    }
    return { ...resultado, sugerenciaIA: sugerencia };
  });
}

export async function solicitarSugerenciasIA(
  datos: DatosConciliacion,
  hacerFetch: typeof fetch = fetch,
): Promise<Resultado[]> {
  const solicitud = crearSolicitudIA(datos);
  if (!solicitud) return datos.resultados;
  const respuesta = await hacerFetch('/api/ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(solicitud.cuerpo),
  });
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(
      typeof cuerpo?.error === 'string'
        ? cuerpo.error
        : 'La IA no pudo generar sugerencias; continuá con la revisión manual',
    );
  }
  return incorporarSugerenciasIA(
    datos.resultados,
    solicitud.resultadoIds,
    await respuesta.json(),
  );
}
