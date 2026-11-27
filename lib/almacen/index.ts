import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlantillaBanco, Regla, ResumenGuardado } from '@/lib/dominio';
import { crearAlmacenLocal, type AlmacenClaveValor } from '@/lib/almacen/local';
import { crearAlmacenSupabase } from '@/lib/almacen/supabase';
import { crearClienteSupabaseNavegador } from '@/lib/supabase/browser';
import {
  resolverConfiguracionSupabase,
  type ConfiguracionSupabase,
} from '@/lib/supabase/config';

export interface Almacen {
  listarReglas(): Promise<Regla[]>;
  guardarRegla(regla: Regla): Promise<void>;
  borrarRegla(id: string): Promise<void>;
  listarPlantillas(): Promise<PlantillaBanco[]>;
  guardarPlantilla(plantilla: PlantillaBanco): Promise<void>;
  borrarPlantilla(id: string): Promise<void>;
  guardarResumen(resumen: ResumenGuardado): Promise<void>;
  listarResumenes(): Promise<ResumenGuardado[]>;
}

interface OpcionesCrearAlmacen {
  configuracion?: ConfiguracionSupabase | null;
  clienteSupabase?: SupabaseClient;
  almacenamientoLocal?: AlmacenClaveValor;
}

export function crearAlmacen({
  configuracion = resolverConfiguracionSupabase(),
  clienteSupabase,
  almacenamientoLocal,
}: OpcionesCrearAlmacen = {}): Almacen {
  if (!configuracion) return crearAlmacenLocal(almacenamientoLocal);
  return crearAlmacenSupabase(
    clienteSupabase ?? crearClienteSupabaseNavegador(configuracion),
  );
}

export { crearAlmacenLocal } from '@/lib/almacen/local';
export { crearAlmacenSupabase } from '@/lib/almacen/supabase';
