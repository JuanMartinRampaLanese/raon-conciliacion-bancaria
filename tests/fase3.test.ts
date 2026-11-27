import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { crearAlmacen } from '@/lib/almacen';
import { crearAlmacenSupabase, filaAPlantilla, filaARegla, filaAResumen } from '@/lib/almacen/supabase';
import type { Resumen } from '@/lib/dominio';
import { resolverConfiguracionSupabase } from '@/lib/supabase/config';
import { destinoInterno, esRutaProtegida } from '@/lib/supabase/proxy';

class AlmacenFalso {
  private datos = new Map<string, string>();
  getItem(clave: string): string | null { return this.datos.get(clave) ?? null; }
  setItem(clave: string, valor: string): void { this.datos.set(clave, valor); }
}

const resumen: Resumen = {
  cantidadBanco: 8,
  cantidadPlanilla: 7,
  conciliados: 6,
  dudosos: 1,
  soloBanco: 1,
  soloPlanilla: 0,
  gastosBancarios: 0,
  porcentajeConciliadoCantidad: 0.75,
  porcentajeConciliadoMonto: 0.8,
  totalesPorEstado: { conciliado: { cantidad: 6, centavos: 123_00 } },
};

describe('configuración de Fase 3', () => {
  it('mantiene el modo local sin variables, con variables parciales o con placeholders', () => {
    expect(resolverConfiguracionSupabase({})).toBeNull();
    expect(resolverConfiguracionSupabase({ url: 'https://real.supabase.co' })).toBeNull();
    expect(resolverConfiguracionSupabase({
      url: 'https://proyecto-falso.supabase.co',
      clavePublicable: 'sb_publishable_clave-falsa-no-usar',
    })).toBeNull();
  });

  it('activa Supabase sólo con URL y clave pública válidas', () => {
    expect(resolverConfiguracionSupabase({
      url: 'https://raon-demo.supabase.co/',
      clavePublicable: 'sb_publishable_prueba-valida',
    })).toEqual({
      url: 'https://raon-demo.supabase.co',
      clavePublica: 'sb_publishable_prueba-valida',
    });
  });

  it('la fábrica local conserva resúmenes enriquecidos sin depender de Supabase', async () => {
    const destino = new AlmacenFalso();
    const almacen = crearAlmacen({ configuracion: null, almacenamientoLocal: destino });
    await almacen.guardarResumen({
      ...resumen,
      nombreBanco: 'BROU',
      moneda: 'UYU',
      periodo: '2026-11',
      cierreOk: true,
      creadoEl: '2026-11-27T12:00:00.000Z',
    });
    await expect(almacen.listarResumenes()).resolves.toMatchObject([
      { nombreBanco: 'BROU', moneda: 'UYU', periodo: '2026-11', cierreOk: true },
    ]);
  });
});

describe('adaptador Supabase', () => {
  it('mapea filas tenant-aware a los tipos del dominio', () => {
    expect(filaARegla({
      regla_id: 'R1', patron: 'COMISION', accion: 'gasto_bancario', cliente: null, origen: 'manual',
    })).toEqual({ id: 'R1', patron: 'COMISION', accion: 'gasto_bancario', origen: 'manual' });
    expect(filaAPlantilla({
      plantilla_id: 'P1', banco: 'BROU', mapeo: { fecha: 'Fecha', importe: 'Monto' },
    })).toEqual({ id: 'P1', banco: 'BROU', mapeo: { fecha: 'Fecha', importe: 'Monto' } });
    expect(filaAResumen({
      conciliacion_id: 'C1', periodo: '2026-11', cantidad_banco: 8, cantidad_planilla: 7,
      conciliados: 6, dudosos: 1, solo_banco: 1, solo_planilla: 0, gastos_bancarios: 0,
      porcentaje_conciliado_cantidad: 0.75, porcentaje_conciliado_monto: 0.8,
      totales_por_estado: resumen.totalesPorEstado, cierre_ok: true,
      creada_el: '2026-11-27T12:00:00.000Z', cuentas: { banco: 'BROU', moneda: 'UYU' },
    })).toMatchObject({
      id: 'C1', nombreBanco: 'BROU', moneda: 'UYU', periodo: '2026-11', cierreOk: true,
    });
  });

  it('rechaza un resumen sin banco, moneda y período antes de tocar la red', async () => {
    const almacen = crearAlmacenSupabase({} as SupabaseClient);
    await expect(almacen.guardarResumen(resumen)).rejects.toThrow('banco, moneda y período');
  });
});

describe('migración y aislamiento', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '202611270001_fase3.sql'),
    'utf8',
  );
  const tablas = ['organizaciones', 'miembros', 'cuentas', 'plantillas_banco', 'reglas', 'conciliaciones'];

  it('crea todas las tablas con organizacion_id y RLS habilitado', () => {
    for (const tabla of tablas) {
      const definicion = sql.match(new RegExp(`create table public\\.${tabla} \\(([\\s\\S]*?)\\n\\);`))?.[1];
      expect(definicion, tabla).toContain('organizacion_id');
      expect(sql).toContain(`alter table public.${tabla} enable row level security;`);
    }
  });

  it('limita las políticas por pertenencia y no define columnas de archivos o movimientos', () => {
    expect(sql).toContain('private.es_miembro');
    expect(sql).toContain('usuario_id = (select auth.uid())');
    const conciliaciones = sql.match(/create table public\.conciliaciones \(([\s\S]*?)\n\);/)?.[1] ?? '';
    expect(conciliaciones).not.toMatch(/archivo|movimiento|bytes/i);
  });

  it('crea organización, owner y reglas predeterminadas en el primer ingreso', () => {
    expect(sql).toContain('crear_organizacion_en_primer_ingreso');
    expect(sql).toContain("values (nueva_organizacion, new.id, 'owner')");
    expect(sql).toContain("'RG-05', 'IMPUESTO'");
  });
});

describe('rutas y corrección visual', () => {
  it('protege las rutas operativas y sólo acepta retornos internos', () => {
    expect(esRutaProtegida('/historial')).toBe(true);
    expect(esRutaProtegida('/conciliar/nueva')).toBe(true);
    expect(esRutaProtegida('/cuenta')).toBe(false);
    expect(destinoInterno('/resultado?tab=dudoso')).toBe('/resultado?tab=dudoso');
    expect(destinoInterno('//sitio-malicioso.example')).toBe('/historial');
    expect(destinoInterno('/\\sitio-malicioso.example')).toBe('/historial');
    expect(destinoInterno('https://sitio-malicioso.example')).toBe('/historial');
  });

  it('apila etiqueta y monto y evita cortar palabras en Fondos y banco', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
    expect(css).toContain('.funds-summary { overflow-wrap: normal; }');
    expect(css).toMatch(/\.funds-summary dl div \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.funds-summary dt \{[^}]*word-break: normal/);
  });

  it('muestra el acceso a la cuenta completamente en español', () => {
    const acceso = readFileSync(join(process.cwd(), 'components', 'acceso-cuenta.tsx'), 'utf8');
    expect(acceso).toContain('Enviarme el enlace');
    expect(acceso).toContain('quedás como dueño');
    expect(acceso).not.toContain('Enviar magic link');
    expect(acceso).not.toContain('quedás como owner');
  });
});
