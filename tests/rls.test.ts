import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const USUARIO_A = '00000000-0000-4000-8000-00000000000a';
const USUARIO_B = '00000000-0000-4000-8000-00000000000b';
const USUARIO_C = '00000000-0000-4000-8000-00000000000c';
const USUARIO_D = '00000000-0000-4000-8000-00000000000d';

type RolPrueba = 'anon' | 'authenticated' | 'supabase_auth_admin';

interface FilaOrganizacion {
  organizacion_id: string;
}

interface FilaCuenta {
  cuenta_id: string;
}

interface FilaConciliacion {
  conciliacion_id: string;
}

function primera<T>(filas: T[], contexto: string): T {
  const fila = filas[0];
  if (!fila) throw new Error(`Falta el dato de prueba: ${contexto}`);
  return fila;
}

describe('RLS de Supabase', () => {
  let base: PGlite;
  let organizacionA = '';
  let organizacionB = '';
  let cuentaA = '';
  let cuentaB = '';
  let conciliacionA = '';
  let miembrosAntesDelIngresoA = -1;
  let rolInicialA = '';
  let reglasInicialesA = -1;

  async function ejecutarComo<T>(
    rol: RolPrueba,
    usuarioId: string | null,
    operacion: () => Promise<T>,
  ): Promise<T> {
    await base.exec('reset role;');
    await base.query("select set_config('request.jwt.claim.sub', $1, false)", [usuarioId ?? '']);
    await base.exec(`set role ${rol};`);
    try {
      return await operacion();
    } finally {
      await base.exec('reset role;');
      await base.query("select set_config('request.jwt.claim.sub', '', false)");
    }
  }

  async function registrarUsuario(id: string, email: string): Promise<void> {
    await ejecutarComo('supabase_auth_admin', null, () =>
      base.query(
        'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)',
        [id, email, '{}'],
      ),
    );
  }

  async function completarPrimerIngreso(id: string): Promise<void> {
    await ejecutarComo('supabase_auth_admin', null, () =>
      base.query('update auth.users set last_sign_in_at = now() where id = $1', [id]),
    );
  }

  async function insertarCuenta(
    organizacionId: string,
    banco: string,
  ): Promise<string> {
    const resultado = await base.query<FilaCuenta>(
      `insert into public.cuentas (organizacion_id, banco, moneda, alias)
       values ($1, $2, 'UYU', $3)
       returning cuenta_id`,
      [organizacionId, banco, `${banco} principal`],
    );
    return primera(resultado.rows, `cuenta de ${banco}`).cuenta_id;
  }

  async function insertarConciliacion(
    organizacionId: string,
    cuentaId: string,
    creadaPor: string,
    periodo: string,
  ) {
    return base.query<FilaConciliacion>(
      `insert into public.conciliaciones (
         organizacion_id, cuenta_id, periodo, cantidad_banco, cantidad_planilla,
         conciliados, dudosos, solo_banco, solo_planilla, gastos_bancarios,
         porcentaje_conciliado_cantidad, porcentaje_conciliado_monto,
         totales_por_estado, cierre_ok, creada_por
       ) values ($1, $2, $3, 1, 1, 1, 0, 0, 0, 0, 1, 1, '{}'::jsonb, true, $4)
       returning conciliacion_id`,
      [organizacionId, cuentaId, periodo, creadaPor],
    );
  }

  async function esperarPermisoDenegado(promesa: Promise<unknown>): Promise<void> {
    await expect(promesa).rejects.toMatchObject({ code: '42501' });
  }

  async function tienePrivilegio(
    rol: RolPrueba,
    tabla: string,
    privilegio: string,
  ): Promise<boolean> {
    const resultado = await base.query<{ permitido: boolean }>(
      'select has_table_privilege($1, $2, $3) as permitido',
      [rol, `public.${tabla}`, privilegio],
    );
    return primera(resultado.rows, `${privilegio} sobre ${tabla}`).permitido;
  }

  beforeAll(async () => {
    base = new PGlite();
    await base.waitReady;
    await base.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role supabase_auth_admin nologin;

      create schema auth authorization supabase_auth_admin;
      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb,
        last_sign_in_at timestamptz
      );
      alter table auth.users owner to supabase_auth_admin;

      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      alter function auth.uid() owner to supabase_auth_admin;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);

    const carpetaMigraciones = join(process.cwd(), 'supabase', 'migrations');
    const migraciones = readdirSync(carpetaMigraciones)
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort();
    for (const archivo of migraciones) {
      const sql = readFileSync(join(carpetaMigraciones, archivo), 'utf8').replace(
        /^\s*create extension if not exists pgcrypto;\s*/im,
        '',
      );
      await base.exec(sql);
    }

    await registrarUsuario(USUARIO_A, 'usuario-a@example.test');
    const antes = await base.query<{ cantidad: number }>(
      'select count(*)::int as cantidad from public.miembros where usuario_id = $1',
      [USUARIO_A],
    );
    miembrosAntesDelIngresoA = primera(antes.rows, 'conteo antes del ingreso').cantidad;
    await completarPrimerIngreso(USUARIO_A);

    await registrarUsuario(USUARIO_B, 'usuario-b@example.test');
    await completarPrimerIngreso(USUARIO_B);
    await registrarUsuario(USUARIO_C, 'usuario-c@example.test');
    await registrarUsuario(USUARIO_D, 'usuario-d@example.test');

    const miembroA = await base.query<FilaOrganizacion & { rol: string }>(
      'select organizacion_id, rol from public.miembros where usuario_id = $1',
      [USUARIO_A],
    );
    const miembroB = await base.query<FilaOrganizacion>(
      'select organizacion_id from public.miembros where usuario_id = $1',
      [USUARIO_B],
    );
    organizacionA = primera(miembroA.rows, 'organización A').organizacion_id;
    organizacionB = primera(miembroB.rows, 'organización B').organizacion_id;
    rolInicialA = primera(miembroA.rows, 'rol inicial A').rol;

    const reglasIniciales = await base.query<{ cantidad: number }>(
      'select count(*)::int as cantidad from public.reglas where organizacion_id = $1',
      [organizacionA],
    );
    reglasInicialesA = primera(reglasIniciales.rows, 'reglas iniciales A').cantidad;

    await ejecutarComo('authenticated', USUARIO_A, async () => {
      cuentaA = await insertarCuenta(organizacionA, 'Banco A');
      await base.query(
        `insert into public.plantillas_banco (organizacion_id, plantilla_id, banco, mapeo)
         values ($1, 'PLANTILLA-A', 'Banco A', '{"fecha":"Fecha"}'::jsonb)`,
        [organizacionA],
      );
      await base.query(
        `insert into public.reglas (organizacion_id, regla_id, patron, accion, origen)
         values ($1, 'REGLA-A', 'PATRON A', 'gasto_bancario', 'manual')`,
        [organizacionA],
      );
      const resultado = await insertarConciliacion(
        organizacionA,
        cuentaA,
        USUARIO_A,
        '2026-11-A',
      );
      conciliacionA = primera(resultado.rows, 'conciliación A').conciliacion_id;
    });

    await ejecutarComo('authenticated', USUARIO_B, async () => {
      cuentaB = await insertarCuenta(organizacionB, 'Banco B');
      await base.query(
        `insert into public.plantillas_banco (organizacion_id, plantilla_id, banco, mapeo)
         values ($1, 'PLANTILLA-B', 'Banco B', '{"fecha":"Fecha"}'::jsonb)`,
        [organizacionB],
      );
      await base.query(
        `insert into public.reglas (organizacion_id, regla_id, patron, accion, origen)
         values ($1, 'REGLA-B', 'PATRON B', 'gasto_bancario', 'manual')`,
        [organizacionB],
      );
      await insertarConciliacion(organizacionB, cuentaB, USUARIO_B, '2026-11-B');
    });

    await base.query(
      `insert into public.miembros (organizacion_id, usuario_id, rol)
       values ($1, $2, 'miembro')`,
      [organizacionA, USUARIO_C],
    );
  }, 30_000);

  afterAll(async () => {
    await base.close();
  });

  it('1. crea organización, owner y cinco reglas al primer ingreso', () => {
    expect(miembrosAntesDelIngresoA).toBe(0);
    expect(organizacionA).not.toBe('');
    expect(rolInicialA).toBe('owner');
    expect(reglasInicialesA).toBe(5);
  });

  it('2. B no ve reglas, plantillas, cuentas ni conciliaciones de A', async () => {
    await ejecutarComo('authenticated', USUARIO_B, async () => {
      for (const tabla of ['reglas', 'plantillas_banco', 'cuentas', 'conciliaciones']) {
        const ajenas = await base.query<{ cantidad: number }>(
          `select count(*)::int as cantidad from public.${tabla} where organizacion_id = $1`,
          [organizacionA],
        );
        const propias = await base.query<{ cantidad: number }>(
          `select count(*)::int as cantidad from public.${tabla} where organizacion_id = $1`,
          [organizacionB],
        );
        expect(primera(ajenas.rows, `${tabla} ajenas`).cantidad, tabla).toBe(0);
        expect(primera(propias.rows, `${tabla} propias`).cantidad, tabla).toBeGreaterThan(0);
      }
    });
  });

  it('3. B no escribe filas de A ni mueve una fila propia a A', async () => {
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        base.query(
          `insert into public.reglas (organizacion_id, regla_id, patron, accion, origen)
           values ($1, 'INTRUSA', 'INTRUSA', 'gasto_bancario', 'manual')`,
          [organizacionA],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        base.query(
          `insert into public.plantillas_banco (organizacion_id, plantilla_id, banco, mapeo)
           values ($1, 'INTRUSA', 'Banco intruso', '{}'::jsonb)`,
          [organizacionA],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        base.query(
          `insert into public.cuentas (organizacion_id, banco, moneda, alias)
           values ($1, 'Banco intruso', 'UYU', 'Intrusa')`,
          [organizacionA],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        insertarConciliacion(organizacionA, cuentaA, USUARIO_B, '2026-INTRUSA'),
      ),
    );

    await ejecutarComo('authenticated', USUARIO_B, async () => {
      const regla = await base.query(
        `update public.reglas set patron = 'ABIERTA'
         where organizacion_id = $1 and regla_id = 'REGLA-A'`,
        [organizacionA],
      );
      const plantilla = await base.query(
        `update public.plantillas_banco set banco = 'Abierto'
         where organizacion_id = $1 and plantilla_id = 'PLANTILLA-A'`,
        [organizacionA],
      );
      const cuenta = await base.query(
        'update public.cuentas set alias = $2 where organizacion_id = $1 and cuenta_id = $3',
        [organizacionA, 'Abierta', cuentaA],
      );
      expect(regla.affectedRows).toBe(0);
      expect(plantilla.affectedRows).toBe(0);
      expect(cuenta.affectedRows).toBe(0);

      const borrarRegla = await base.query(
        `delete from public.reglas where organizacion_id = $1 and regla_id = 'REGLA-A'`,
        [organizacionA],
      );
      const borrarPlantilla = await base.query(
        `delete from public.plantillas_banco
         where organizacion_id = $1 and plantilla_id = 'PLANTILLA-A'`,
        [organizacionA],
      );
      const borrarCuenta = await base.query(
        'delete from public.cuentas where organizacion_id = $1 and cuenta_id = $2',
        [organizacionA, cuentaA],
      );
      const borrarConciliacion = await base.query(
        'delete from public.conciliaciones where organizacion_id = $1 and conciliacion_id = $2',
        [organizacionA, conciliacionA],
      );
      expect(borrarRegla.affectedRows).toBe(0);
      expect(borrarPlantilla.affectedRows).toBe(0);
      expect(borrarCuenta.affectedRows).toBe(0);
      expect(borrarConciliacion.affectedRows).toBe(0);
    });

    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        base.query(
          `update public.reglas set organizacion_id = $1
           where organizacion_id = $2 and regla_id = 'REGLA-B'`,
          [organizacionA, organizacionB],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        base.query(
          `update public.conciliaciones set periodo = 'CAMBIADO'
           where organizacion_id = $1`,
          [organizacionA],
        ),
      ),
    );
  });

  it('4. B no puede agregarse como miembro de A', async () => {
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        base.query(
          `insert into public.miembros (organizacion_id, usuario_id, rol)
           values ($1, $2, 'owner')`,
          [organizacionA, USUARIO_B],
        ),
      ),
    );
    const resultado = await base.query<{ cantidad: number }>(
      `select count(*)::int as cantidad from public.miembros
       where organizacion_id = $1 and usuario_id = $2`,
      [organizacionA, USUARIO_B],
    );
    expect(primera(resultado.rows, 'membresía cruzada').cantidad).toBe(0);
  });

  it('5. un miembro no administra miembros, organización ni historial', async () => {
    expect(await tienePrivilegio('authenticated', 'miembros', 'INSERT')).toBe(false);
    expect(await tienePrivilegio('authenticated', 'miembros', 'UPDATE')).toBe(false);
    expect(await tienePrivilegio('authenticated', 'miembros', 'DELETE')).toBe(false);
    expect(await tienePrivilegio('authenticated', 'organizaciones', 'INSERT')).toBe(false);
    expect(await tienePrivilegio('authenticated', 'organizaciones', 'UPDATE')).toBe(true);
    expect(await tienePrivilegio('authenticated', 'organizaciones', 'DELETE')).toBe(false);
    expect(await tienePrivilegio('authenticated', 'conciliaciones', 'UPDATE')).toBe(false);
    expect(await tienePrivilegio('authenticated', 'conciliaciones', 'DELETE')).toBe(true);

    const miembrosVisibles = await ejecutarComo('authenticated', USUARIO_C, () =>
      base.query<{ cantidad: number }>(
        'select count(*)::int as cantidad from public.miembros where organizacion_id = $1',
        [organizacionA],
      ),
    );
    expect(primera(miembrosVisibles.rows, 'miembros visibles').cantidad).toBeGreaterThan(0);

    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_C, () =>
        base.query(
          `insert into public.miembros (organizacion_id, usuario_id, rol)
           values ($1, $2, 'miembro')`,
          [organizacionA, USUARIO_D],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_C, () =>
        base.query(
          `update public.miembros set rol = 'owner'
           where organizacion_id = $1 and usuario_id = $2`,
          [organizacionA, USUARIO_C],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_C, () =>
        base.query(
          'delete from public.miembros where organizacion_id = $1 and usuario_id = $2',
          [organizacionA, USUARIO_C],
        ),
      ),
    );

    const renombradoMiembro = await ejecutarComo('authenticated', USUARIO_C, () =>
      base.query('update public.organizaciones set nombre = $2 where organizacion_id = $1', [
        organizacionA,
        'Nombre indebido',
      ]),
    );
    expect(renombradoMiembro.affectedRows).toBe(0);

    const renombradoOwner = await ejecutarComo('authenticated', USUARIO_A, () =>
      base.query('update public.organizaciones set nombre = $2 where organizacion_id = $1', [
        organizacionA,
        'Organización A',
      ]),
    );
    expect(renombradoOwner.affectedRows).toBe(1);

    for (const usuario of [USUARIO_C, USUARIO_A]) {
      await esperarPermisoDenegado(
        ejecutarComo('authenticated', usuario, () =>
          base.query("insert into public.organizaciones (nombre) values ('No permitida')"),
        ),
      );
      await esperarPermisoDenegado(
        ejecutarComo('authenticated', usuario, () =>
          base.query('delete from public.organizaciones where organizacion_id = $1', [
            organizacionA,
          ]),
        ),
      );
    }

    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_C, () =>
        base.query(
          'update public.conciliaciones set periodo = $3 where organizacion_id = $1 and conciliacion_id = $2',
          [organizacionA, conciliacionA, 'ALTERADO'],
        ),
      ),
    );
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_A, () =>
        base.query(
          'update public.conciliaciones set periodo = $3 where organizacion_id = $1 and conciliacion_id = $2',
          [organizacionA, conciliacionA, 'ALTERADO'],
        ),
      ),
    );

    const borradoMiembro = await ejecutarComo('authenticated', USUARIO_C, () =>
      base.query(
        'delete from public.conciliaciones where organizacion_id = $1 and conciliacion_id = $2',
        [organizacionA, conciliacionA],
      ),
    );
    expect(borradoMiembro.affectedRows).toBe(0);

    const temporal = await ejecutarComo('authenticated', USUARIO_A, () =>
      insertarConciliacion(organizacionA, cuentaA, USUARIO_A, '2026-TEMPORAL'),
    );
    const temporalId = primera(temporal.rows, 'conciliación temporal').conciliacion_id;
    const borradoOwner = await ejecutarComo('authenticated', USUARIO_A, () =>
      base.query(
        'delete from public.conciliaciones where organizacion_id = $1 and conciliacion_id = $2',
        [organizacionA, temporalId],
      ),
    );
    expect(borradoOwner.affectedRows).toBe(1);
  });

  it('6. anon no puede leer ninguna tabla', async () => {
    for (const tabla of [
      'organizaciones',
      'miembros',
      'cuentas',
      'plantillas_banco',
      'reglas',
      'conciliaciones',
    ]) {
      expect(await tienePrivilegio('anon', tabla, 'SELECT'), tabla).toBe(false);
      await esperarPermisoDenegado(
        ejecutarComo('anon', null, () => base.query(`select * from public.${tabla} limit 1`)),
      );
    }
  });

  it('7. no guarda una conciliación con creada_por de otro usuario', async () => {
    await esperarPermisoDenegado(
      ejecutarComo('authenticated', USUARIO_B, () =>
        insertarConciliacion(organizacionB, cuentaB, USUARIO_A, '2026-AUTOR-FALSO'),
      ),
    );
    const resultado = await ejecutarComo('authenticated', USUARIO_B, () =>
      base.query<{ cantidad: number }>(
        `select count(*)::int as cantidad from public.conciliaciones
         where organizacion_id = $1 and periodo = '2026-AUTOR-FALSO'`,
        [organizacionB],
      ),
    );
    expect(primera(resultado.rows, 'autor falso').cantidad).toBe(0);
  });
});
