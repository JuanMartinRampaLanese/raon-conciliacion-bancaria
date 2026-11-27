import { respuestaIAEsquema, solicitudIAEsquema } from '@/lib/ia/esquemas';
import type { ProveedorIA } from '@/lib/ia';

const MAXIMO_CUERPO_BYTES = 128_000;

interface DependenciasRutaIA {
  habilitada: boolean;
  proveedor: ProveedorIA | null;
  autenticar: () => Promise<string | null>;
  consumirCuota: (usuarioId: string) => Promise<boolean>;
  timeoutMs?: number;
}

function respuestaError(mensaje: string, status: number): Response {
  return Response.json({ error: mensaje }, { status });
}

export function crearManejadorIA({
  habilitada,
  proveedor,
  autenticar,
  consumirCuota,
  timeoutMs = 10_000,
}: DependenciasRutaIA): (solicitud: Request) => Promise<Response> {
  return async (solicitud) => {
    if (!habilitada) return respuestaError('La asistencia con IA no está habilitada', 404);
    if (!proveedor) return respuestaError('La asistencia con IA no está configurada', 503);

    let usuarioId: string | null;
    try {
      usuarioId = await autenticar();
    } catch {
      return respuestaError('No se pudo verificar la sesión', 503);
    }
    if (!usuarioId) return respuestaError('Necesitás iniciar sesión para usar la IA', 401);

    if (!solicitud.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return respuestaError('Enviá el contenido como JSON', 415);
    }

    let texto: string;
    try {
      texto = await solicitud.text();
    } catch {
      return respuestaError('No se pudo leer la solicitud', 400);
    }
    if (new TextEncoder().encode(texto).byteLength > MAXIMO_CUERPO_BYTES) {
      return respuestaError('La solicitud supera el tamaño permitido', 413);
    }

    let entrada: unknown;
    try {
      entrada = JSON.parse(texto);
    } catch {
      return respuestaError('El JSON no es válido', 400);
    }
    const validacion = solicitudIAEsquema.safeParse(entrada);
    if (!validacion.success) {
      return respuestaError('Los casos dudosos no tienen el formato esperado', 400);
    }

    try {
      if (!(await consumirCuota(usuarioId))) {
        return respuestaError(
          'Alcanzaste el límite de 20 pedidos por hora. Probá nuevamente más tarde',
          429,
        );
      }
    } catch {
      return respuestaError('No se pudo verificar el límite de uso', 503);
    }

    const controlador = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      const limite = new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(() => {
          controlador.abort();
          rechazar(new Error('TIMEOUT_IA'));
        }, timeoutMs);
      });
      const salida = await Promise.race([
        proveedor.sugerir(validacion.data, controlador.signal),
        limite,
      ]);
      const validacionSalida = respuestaIAEsquema.safeParse(salida);
      if (!validacionSalida.success || validacionSalida.data.sugerencias.length !== validacion.data.dudosos.length) {
        return respuestaError('La IA no devolvió sugerencias utilizables', 502);
      }
      const indicesValidos = validacionSalida.data.sugerencias.every(
        (sugerencia, indice) =>
          sugerencia.indice === null ||
          sugerencia.indice < validacion.data.dudosos[indice].candidatos.length,
      );
      if (!indicesValidos) return respuestaError('La IA no devolvió sugerencias utilizables', 502);
      return Response.json(validacionSalida.data);
    } catch (error) {
      const esTimeout = error instanceof Error && error.message === 'TIMEOUT_IA';
      return respuestaError(
        esTimeout
          ? 'La IA demoró demasiado; podés continuar con la revisión manual'
          : 'La IA no pudo generar sugerencias; podés continuar con la revisión manual',
        esTimeout ? 504 : 502,
      );
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  };
}
