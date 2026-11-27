import { describe, expect, it } from 'vitest';
import { crearCabecerasSeguridad, crearCsp } from '@/lib/seguridad/headers';
import { resolverConfiguracionSupabase } from '@/lib/supabase/config';

describe('cabeceras de seguridad', () => {
  it('no habilita Supabase ni Gemini sin una configuración válida', () => {
    const csp = crearCsp({ supabase: null, desarrollo: false });
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/supabase|googleapis|generativelanguage/i);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('tampoco abre la CSP con los placeholders del modo local', () => {
    const configuracion = resolverConfiguracionSupabase({
      url: 'https://proyecto-falso.supabase.co',
      clavePublicable: 'sb_publishable_clave-falsa-no-usar',
    });
    expect(configuracion).toBeNull();
    expect(crearCsp({ supabase: configuracion, desarrollo: false })).not.toContain('supabase.co');
  });

  it('permite sólo los orígenes HTTPS y WSS del Supabase configurado', () => {
    const csp = crearCsp({
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
      crearCabecerasSeguridad({ supabase: null, desarrollo: false }).map(({ key, value }) => [
        key,
        value,
      ]),
    );
    expect(cabeceras['Content-Security-Policy']).toBeTruthy();
    expect(cabeceras['X-Content-Type-Options']).toBe('nosniff');
    expect(cabeceras['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(cabeceras['Permissions-Policy']).toContain('camera=()');
    expect(cabeceras['Permissions-Policy']).toContain('microphone=()');
  });
});
