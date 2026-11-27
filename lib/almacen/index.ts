import type { PlantillaBanco, Regla, Resumen } from '@/lib/dominio';

export interface Almacen {
  listarReglas(): Promise<Regla[]>;
  guardarRegla(regla: Regla): Promise<void>;
  borrarRegla(id: string): Promise<void>;
  listarPlantillas(): Promise<PlantillaBanco[]>;
  guardarPlantilla(plantilla: PlantillaBanco): Promise<void>;
  borrarPlantilla(id: string): Promise<void>;
  guardarResumen(resumen: Resumen): Promise<void>;
  listarResumenes(): Promise<Resumen[]>;
}

export { crearAlmacenLocal } from '@/lib/almacen/local';
