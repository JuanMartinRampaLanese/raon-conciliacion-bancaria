import type { NextRequest } from 'next/server';
import { actualizarSesion } from '@/lib/supabase/proxy';
import { crearCsp, generarNonce } from '@/lib/seguridad/headers';

export async function proxy(request: NextRequest) {
  const nonce = generarNonce();
  const csp = crearCsp({ nonce });
  const cabecerasSolicitud = new Headers(request.headers);
  cabecerasSolicitud.set('x-nonce', nonce);
  cabecerasSolicitud.set('Content-Security-Policy', csp);

  const respuesta = await actualizarSesion(request, cabecerasSolicitud);
  respuesta.headers.set('Content-Security-Policy', csp);
  return respuesta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
