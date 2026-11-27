import type { SupabaseClient } from '@supabase/supabase-js';
import type { Almacen } from '@/lib/almacen';
import type {
  Moneda,
  PlantillaBanco,
  Regla,
  Resumen,
  ResumenGuardado,
} from '@/lib/dominio';

interface ContextoTenant {
  organizacionId: string;
  usuarioId: string;
}

interface FilaRegla {
  regla_id: string;
  patron: string;
  accion: Regla['accion'];
  cliente: string | null;
  origen: Regla['origen'];
}

interface FilaPlantilla {
  plantilla_id: string;
  banco: string;
  mapeo: PlantillaBanco['mapeo'];
}

interface FilaCuenta {
  banco: string;
  moneda: Moneda;
}

interface FilaConciliacion {
  conciliacion_id: string;
  periodo: string;
  cantidad_banco: number;
  cantidad_planilla: number;
  conciliados: number;
  dudosos: number;
  solo_banco: number;
  solo_planilla: number;
  gastos_bancarios: number;
  porcentaje_conciliado_cantidad: number;
  porcentaje_conciliado_monto: number;
  totales_por_estado: Resumen['totalesPorEstado'];
  cierre_ok: boolean | null;
  creada_el: string;
  cuentas: FilaCuenta | FilaCuenta[];
}

function comprobar(error: { message: string } | null, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

export function filaARegla(fila: FilaRegla): Regla {
  return {
    id: fila.regla_id,
    patron: fila.patron,
    accion: fila.accion,
    cliente: fila.cliente ?? undefined,
    origen: fila.origen,
  };
}

export function filaAPlantilla(fila: FilaPlantilla): PlantillaBanco {
  return { id: fila.plantilla_id, banco: fila.banco, mapeo: { ...fila.mapeo } };
}

export function filaAResumen(fila: FilaConciliacion): ResumenGuardado {
  const cuenta = Array.isArray(fila.cuentas) ? fila.cuentas[0] : fila.cuentas;
  return {
    id: fila.conciliacion_id,
    nombreBanco: cuenta?.banco,
    moneda: cuenta?.moneda,
    periodo: fila.periodo,
    cierreOk: fila.cierre_ok,
    creadoEl: fila.creada_el,
    cantidadBanco: fila.cantidad_banco,
    cantidadPlanilla: fila.cantidad_planilla,
    conciliados: fila.conciliados,
    dudosos: fila.dudosos,
    soloBanco: fila.solo_banco,
    soloPlanilla: fila.solo_planilla,
    gastosBancarios: fila.gastos_bancarios,
    porcentajeConciliadoCantidad: fila.porcentaje_conciliado_cantidad,
    porcentajeConciliadoMonto: fila.porcentaje_conciliado_monto,
    totalesPorEstado: fila.totales_por_estado ?? {},
  };
}

function metadatosCompletos(resumen: ResumenGuardado): resumen is ResumenGuardado & {
  nombreBanco: string;
  moneda: Moneda;
  periodo: string;
} {
  return Boolean(resumen.nombreBanco?.trim() && resumen.moneda && resumen.periodo?.trim());
}

export function crearAlmacenSupabase(cliente: SupabaseClient): Almacen {
  let contextoPendiente: Promise<ContextoTenant> | undefined;

  const contexto = () => {
    contextoPendiente ??= (async () => {
      const { data: sesion, error: errorUsuario } = await cliente.auth.getUser();
      comprobar(errorUsuario, 'No se pudo leer la sesión');
      if (!sesion.user) throw new Error('Iniciá sesión para usar el almacenamiento de la cuenta');
      const { data, error } = await cliente
        .from('miembros')
        .select('organizacion_id')
        .eq('usuario_id', sesion.user.id)
        .order('creado_el', { ascending: true })
        .limit(1)
        .maybeSingle();
      comprobar(error, 'No se pudo leer la organización');
      if (!data) throw new Error('La cuenta todavía no tiene una organización asociada');
      return { organizacionId: data.organizacion_id as string, usuarioId: sesion.user.id };
    })();
    return contextoPendiente;
  };

  return {
    async listarReglas() {
      const { organizacionId } = await contexto();
      const { data, error } = await cliente
        .from('reglas')
        .select('regla_id, patron, accion, cliente, origen')
        .eq('organizacion_id', organizacionId)
        .order('patron');
      comprobar(error, 'No se pudieron leer las reglas');
      return ((data ?? []) as FilaRegla[]).map(filaARegla);
    },
    async guardarRegla(regla) {
      const { organizacionId } = await contexto();
      const { error } = await cliente.from('reglas').upsert(
        {
          organizacion_id: organizacionId,
          regla_id: regla.id,
          patron: regla.patron,
          accion: regla.accion,
          cliente: regla.cliente ?? null,
          origen: regla.origen,
        },
        { onConflict: 'organizacion_id,regla_id' },
      );
      comprobar(error, 'No se pudo guardar la regla');
    },
    async borrarRegla(id) {
      const { organizacionId } = await contexto();
      const { error } = await cliente
        .from('reglas')
        .delete()
        .eq('organizacion_id', organizacionId)
        .eq('regla_id', id);
      comprobar(error, 'No se pudo borrar la regla');
    },
    async listarPlantillas() {
      const { organizacionId } = await contexto();
      const { data, error } = await cliente
        .from('plantillas_banco')
        .select('plantilla_id, banco, mapeo')
        .eq('organizacion_id', organizacionId)
        .order('banco');
      comprobar(error, 'No se pudieron leer las plantillas');
      return ((data ?? []) as FilaPlantilla[]).map(filaAPlantilla);
    },
    async guardarPlantilla(plantilla) {
      const { organizacionId } = await contexto();
      const { error } = await cliente.from('plantillas_banco').upsert(
        {
          organizacion_id: organizacionId,
          plantilla_id: plantilla.id,
          banco: plantilla.banco,
          mapeo: plantilla.mapeo,
        },
        { onConflict: 'organizacion_id,plantilla_id' },
      );
      comprobar(error, 'No se pudo guardar la plantilla');
    },
    async borrarPlantilla(id) {
      const { organizacionId } = await contexto();
      const { error } = await cliente
        .from('plantillas_banco')
        .delete()
        .eq('organizacion_id', organizacionId)
        .eq('plantilla_id', id);
      comprobar(error, 'No se pudo borrar la plantilla');
    },
    async guardarResumen(resumen) {
      if (!metadatosCompletos(resumen)) {
        throw new Error('El resumen necesita banco, moneda y período para guardarse en la cuenta');
      }
      const { organizacionId, usuarioId } = await contexto();
      const { data: cuenta, error: errorCuenta } = await cliente
        .from('cuentas')
        .upsert(
          {
            organizacion_id: organizacionId,
            banco: resumen.nombreBanco,
            moneda: resumen.moneda,
            alias: `${resumen.nombreBanco} ${resumen.moneda}`,
          },
          { onConflict: 'organizacion_id,banco,moneda' },
        )
        .select('cuenta_id')
        .single();
      comprobar(errorCuenta, 'No se pudo guardar la cuenta bancaria');
      if (!cuenta) throw new Error('No se pudo identificar la cuenta bancaria');

      const { error } = await cliente.from('conciliaciones').insert({
        organizacion_id: organizacionId,
        cuenta_id: cuenta.cuenta_id as string,
        periodo: resumen.periodo,
        cantidad_banco: resumen.cantidadBanco,
        cantidad_planilla: resumen.cantidadPlanilla,
        conciliados: resumen.conciliados,
        dudosos: resumen.dudosos,
        solo_banco: resumen.soloBanco,
        solo_planilla: resumen.soloPlanilla,
        gastos_bancarios: resumen.gastosBancarios,
        porcentaje_conciliado_cantidad: resumen.porcentajeConciliadoCantidad,
        porcentaje_conciliado_monto: resumen.porcentajeConciliadoMonto,
        totales_por_estado: resumen.totalesPorEstado,
        cierre_ok: resumen.cierreOk ?? null,
        creada_por: usuarioId,
      });
      comprobar(error, 'No se pudo guardar el resumen de la conciliación');
    },
    async listarResumenes() {
      const { organizacionId } = await contexto();
      const { data, error } = await cliente
        .from('conciliaciones')
        .select(
          'conciliacion_id, periodo, cantidad_banco, cantidad_planilla, conciliados, dudosos, solo_banco, solo_planilla, gastos_bancarios, porcentaje_conciliado_cantidad, porcentaje_conciliado_monto, totales_por_estado, cierre_ok, creada_el, cuentas!inner(banco, moneda)',
        )
        .eq('organizacion_id', organizacionId)
        .order('creada_el', { ascending: false })
        .limit(100);
      comprobar(error, 'No se pudo leer el historial');
      return ((data ?? []) as unknown as FilaConciliacion[]).map(filaAResumen);
    },
  };
}

export type { FilaConciliacion, FilaPlantilla, FilaRegla };
