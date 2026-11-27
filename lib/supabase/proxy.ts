import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolverConfiguracionSupabase } from '@/lib/supabase/config';

const RUTAS_PROTEGIDAS = ['/conciliar', '/resultado', '/reglas', '/historial'];

export function esRutaProtegida(ruta: string): boolean {
  return RUTAS_PROTEGIDAS.some((base) => ruta === base || ruta.startsWith(`${base}/`));
}

export function destinoInterno(valor: string | null, respaldo = '/historial'): string {
  if (!valor?.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return respaldo;
  const destino = new URL(valor, 'https://raon.local');
  return destino.origin === 'https://raon.local' ? `${destino.pathname}${destino.search}${destino.hash}` : respaldo;
}

export async function actualizarSesion(
  request: NextRequest,
  cabecerasSolicitud = new Headers(request.headers),
): Promise<NextResponse> {
  const configuracion = resolverConfiguracionSupabase();
  if (!configuracion) {
    return NextResponse.next({ request: { headers: cabecerasSolicitud } });
  }

  let respuesta = NextResponse.next({ request: { headers: cabecerasSolicitud } });
  const supabase = createServerClient(configuracion.url, configuracion.clavePublica, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesNuevas) {
        cookiesNuevas.forEach(({ name, value }) => request.cookies.set(name, value));
        const cookie = request.headers.get('cookie');
        if (cookie) cabecerasSolicitud.set('cookie', cookie);
        respuesta = NextResponse.next({ request: { headers: cabecerasSolicitud } });
        cookiesNuevas.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && esRutaProtegida(request.nextUrl.pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/cuenta';
    destino.search = '';
    destino.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(destino);
  }

  return respuesta;
}
