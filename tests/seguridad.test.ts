import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearCabecerasSeguridad, crearCsp, generarNonce } from '@/lib/seguridad/headers';
import { resolverConfiguracionSupabase } from '@/lib/supabase/config';

describe('cabeceras de seguridad', () => {
  it('no habilita Supabase ni Gemini sin una configuración válida', () => {
    const csp = crearCsp({ nonce: 'nonce-prueba', supabase: null, desarrollo: false });
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self' 'nonce-nonce-prueba' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/supabase|googleapis|generativelanguage/i);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('tampoco abre la CSP con los placeholders del modo local', () => {
    const configuracion = resolverConfiguracionSupabase({
      url: 'https://proyecto-falso.supabase.co',
      clavePublicable: 'sb_publishable_clave-falsa-no-usar',
    });
    expect(configuracion).toBeNull();
    expect(crearCsp({ nonce: 'nonce-prueba', supabase: configuracion, desarrollo: false })).not.toContain('supabase.co');
  });

  it('permite sólo los orígenes HTTPS y WSS del Supabase configurado', () => {
    const csp = crearCsp({
      nonce: 'nonce-prueba',
      supabase: {
        url: 'https://raon-ejemplo.supabase.co',
        clavePublica: 'sb_publishable_prueba-valida',
      },
      desarrollo: false,
    });
    expect(csp).toContain(
      "connect-src 'self' https://raon-ejemplo.supabase.co wss://raon-ejemplo.supabase.co",
    );
    expect(csp).not.toMatch(/googleapis|generativelanguage/i);
  });

  it('incluye las cuatro cabeceras requeridas y políticas restrictivas', () => {
    const cabeceras = Object.fromEntries(
      crearCabecerasSeguridad().map(({ key, value }) => [
        key,
        value,
      ]),
    );
    expect(cabeceras['Content-Security-Policy']).toBeUndefined();
    expect(cabeceras['X-Content-Type-Options']).toBe('nosniff');
    expect(cabeceras['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(cabeceras['Permissions-Policy']).toContain('camera=()');
    expect(cabeceras['Permissions-Policy']).toContain('microphone=()');
  });

  it('usa unsafe-eval sólo en desarrollo y genera una nonce nueva por pedido', () => {
    const desarrollo = crearCsp({ nonce: 'desarrollo', supabase: null, desarrollo: true });
    const produccion = crearCsp({ nonce: 'produccion', supabase: null, desarrollo: false });
    expect(desarrollo).toContain("'unsafe-eval'");
    expect(produccion).not.toContain("'unsafe-eval'");
    expect(produccion).not.toContain("'unsafe-inline'");
    expect(generarNonce(() => '00000000-0000-4000-8000-000000000001')).not.toBe(
      generarNonce(() => '00000000-0000-4000-8000-000000000002'),
    );
  });

  it('propaga CSP y x-nonce desde Proxy y no deja estilos propios inline', () => {
    const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8');
    const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8');
    const asistente = readFileSync(
      join(process.cwd(), 'components', 'asistente-conciliacion.tsx'),
      'utf8',
    );
    expect(proxy).toContain("cabecerasSolicitud.set('x-nonce', nonce)");
    expect(proxy).toContain("cabecerasSolicitud.set('Content-Security-Policy', csp)");
    expect(proxy).toContain("respuesta.headers.set('Content-Security-Policy', csp)");
    expect(layout).toContain('await connection()');
    expect(asistente).not.toContain('style={{');
  });
});
