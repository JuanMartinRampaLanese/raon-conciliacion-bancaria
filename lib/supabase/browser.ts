import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolverConfiguracionSupabase,
  type ConfiguracionSupabase,
} from '@/lib/supabase/config';

let clienteCompartido: SupabaseClient | undefined;

export function crearClienteSupabaseNavegador(
  configuracion: ConfiguracionSupabase | null = resolverConfiguracionSupabase(),
): SupabaseClient {
  if (!configuracion) throw new Error('Supabase no está configurado');
  if (!clienteCompartido) {
    clienteCompartido = createBrowserClient(configuracion.url, configuracion.clavePublica);
  }
  return clienteCompartido;
}
