import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolverConfiguracionSupabase } from '@/lib/supabase/config';

export async function crearClienteSupabaseServidor() {
  const configuracion = resolverConfiguracionSupabase();
  if (!configuracion) throw new Error('Supabase no está configurado');
  const almacenCookies = await cookies();

  return createServerClient(configuracion.url, configuracion.clavePublica, {
    cookies: {
      getAll() {
        return almacenCookies.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          cookiesNuevas.forEach(({ name, value, options }) =>
            almacenCookies.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies; Proxy ya refresca la sesión.
        }
      },
    },
  });
}
