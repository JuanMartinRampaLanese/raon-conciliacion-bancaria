import {
  resolverConfiguracionSupabase,
  type ConfiguracionSupabase,
} from '../supabase/config';

export interface OpcionesSeguridad {
  nonce: string;
  supabase?: ConfiguracionSupabase | null;
  desarrollo?: boolean;
}

function origenWebSocket(origen: string): string {
  const url = new URL(origen);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}

export function crearCsp({
  nonce,
  supabase = resolverConfiguracionSupabase(),
  desarrollo = process.env.NODE_ENV !== 'production',
}: OpcionesSeguridad): string {
  const conexiones = ["'self'"];
  if (supabase) {
    const origen = new URL(supabase.url).origin;
    conexiones.push(origen, origenWebSocket(origen));
  }
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (desarrollo) scripts.push("'unsafe-eval'");
  const estilos = ["'self'", `'nonce-${nonce}'`];
  if (desarrollo) estilos.push("'unsafe-inline'");
  const directivas = [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    `style-src ${estilos.join(' ')}`,
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

export function generarNonce(generarUuid: () => string = () => crypto.randomUUID()): string {
  return btoa(generarUuid());
}

export function crearCabecerasSeguridad(): Array<{ key: string; value: string }> {
  return [
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
