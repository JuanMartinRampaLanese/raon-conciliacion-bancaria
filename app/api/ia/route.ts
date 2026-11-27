import { ProveedorGemini } from '@/lib/ia/gemini';
import { iaFueHabilitada, resolverConfiguracionIA } from '@/lib/ia';
import { crearManejadorIA } from '@/lib/ia/route';

export const runtime = 'nodejs';

export async function POST(solicitud: Request): Promise<Response> {
  const configuracion = resolverConfiguracionIA();
  const manejar = crearManejadorIA({
    habilitada: iaFueHabilitada(),
    proveedor: configuracion
      ? new ProveedorGemini(configuracion.modelo, configuracion.claveGemini)
      : null,
  });
  return manejar(solicitud);
}
