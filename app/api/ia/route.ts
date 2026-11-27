import { ProveedorGemini } from '@/lib/ia/gemini';
import { resolverConfiguracionIA } from '@/lib/ia';
import { crearManejadorIA } from '@/lib/ia/route';
import { crearClienteSupabaseServidor } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(solicitud: Request): Promise<Response> {
  const configuracion = resolverConfiguracionIA();
  const supabase = configuracion ? await crearClienteSupabaseServidor() : null;
  const manejar = crearManejadorIA({
    habilitada: configuracion !== null,
    proveedor: configuracion
      ? new ProveedorGemini(configuracion.modelo, configuracion.claveGemini)
      : null,
    autenticar: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.auth.getClaims();
      const usuarioId = data?.claims?.sub;
      return !error && typeof usuarioId === 'string' ? usuarioId : null;
    },
    consumirCuota: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc('registrar_uso_ia');
      if (error) throw new Error('No se pudo registrar el uso de IA');
      return data === true;
    },
  });
  return manejar(solicitud);
}
