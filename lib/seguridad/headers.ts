import {
  resolverConfiguracionSupabase,
  type ConfiguracionSupabase,
} from '../supabase/config';

export interface OpcionesSeguridad {
  supabase?: ConfiguracionSupabase | null;
  desarrollo?: boolean;
}

function origenWebSocket(origen: string): string {
  const url = new URL(origen);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}

export function crearCsp({
  supabase = resolverConfiguracionSupabase(),
  desarrollo = process.env.NODE_ENV !== 'production',
}: OpcionesSeguridad = {}): string {
  const conexiones = ["'self'"];
  if (supabase) {
    const origen = new URL(supabase.url).origin;
    conexiones.push(origen, origenWebSocket(origen));
  }
  const scripts = ["'self'", "'unsafe-inline'"];
  if (desarrollo) scripts.push("'unsafe-eval'");
  const directivas = [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${conexiones.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "media-src 'none'",
    "manifest-src 'self'",
  ];
  if (!desarrollo) directivas.push('upgrade-insecure-requests');
  return directivas.join('; ');
}

export function crearCabecerasSeguridad(
  opciones: OpcionesSeguridad = {},
): Array<{ key: string; value: string }> {
  return [
    { key: 'Content-Security-Policy', value: crearCsp(opciones) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value:
        'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), usb=()',
    },
  ];
}
