import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { crearClienteSupabaseServidor } from '@/lib/supabase/server';
import { resolverConfiguracionSupabase } from '@/lib/supabase/config';
import { destinoInterno } from '@/lib/supabase/proxy';

const ParametrosCallback = z.object({
  code: z.string().min(1).max(4096).optional(),
  next: z.string().max(2048).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parametros = ParametrosCallback.safeParse(Object.fromEntries(url.searchParams));
  const codigo = parametros.success ? parametros.data.code : undefined;
  const siguiente = destinoInterno(parametros.success ? (parametros.data.next ?? null) : null);

  if (!resolverConfiguracionSupabase()) return NextResponse.redirect(new URL('/', url.origin));

  if (codigo) {
    const supabase = await crearClienteSupabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin));
  }

  const destino = new URL('/cuenta', url.origin);
  destino.searchParams.set('error', 'No pudimos validar el enlace. Pedí uno nuevo.');
  return NextResponse.redirect(destino);
}
