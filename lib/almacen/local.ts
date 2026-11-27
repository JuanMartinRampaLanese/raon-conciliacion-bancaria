import type { Almacen } from '@/lib/almacen';
import type { PlantillaBanco, Regla, Resumen } from '@/lib/dominio';
import { REGLAS_GASTOS_PREDETERMINADAS } from '@/lib/motor';

interface AlmacenClaveValor {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

const CLAVES = {
  reglas: 'raon.conciliacion.reglas.v1',
  plantillas: 'raon.conciliacion.plantillas.v1',
  resumenes: 'raon.conciliacion.resumenes.v1',
} as const;

function copiarReglasIniciales(): Regla[] {
  return REGLAS_GASTOS_PREDETERMINADAS.map((regla) => ({ ...regla }));
}

function leer<T>(almacen: AlmacenClaveValor | undefined, clave: string, inicial: T): T {
  if (!almacen) return inicial;
  try {
    const valor = almacen.getItem(clave);
    return valor ? (JSON.parse(valor) as T) : inicial;
  } catch {
    return inicial;
  }
}

function escribir<T>(almacen: AlmacenClaveValor | undefined, clave: string, valor: T): void {
  if (!almacen) return;
  try {
    almacen.setItem(clave, JSON.stringify(valor));
  } catch {
    // El modo local sigue funcionando aunque el navegador bloquee localStorage.
  }
}

export function crearAlmacenLocal(almacen?: AlmacenClaveValor): Almacen {
  const destino =
    almacen ?? (typeof window !== 'undefined' ? (window.localStorage as AlmacenClaveValor) : undefined);
  let reglasMemoria = leer(destino, CLAVES.reglas, copiarReglasIniciales());
  let plantillasMemoria = leer<PlantillaBanco[]>(destino, CLAVES.plantillas, []);
  let resumenesMemoria = leer<Resumen[]>(destino, CLAVES.resumenes, []);

  return {
    async listarReglas() {
      return reglasMemoria.map((regla) => ({ ...regla }));
    },
    async guardarRegla(regla) {
      reglasMemoria = [...reglasMemoria.filter((item) => item.id !== regla.id), { ...regla }];
      escribir(destino, CLAVES.reglas, reglasMemoria);
    },
    async borrarRegla(id) {
      reglasMemoria = reglasMemoria.filter((regla) => regla.id !== id);
      escribir(destino, CLAVES.reglas, reglasMemoria);
    },
    async listarPlantillas() {
      return plantillasMemoria.map((plantilla) => ({ ...plantilla, mapeo: { ...plantilla.mapeo } }));
    },
    async guardarPlantilla(plantilla) {
      plantillasMemoria = [
        ...plantillasMemoria.filter((item) => item.id !== plantilla.id),
        { ...plantilla, mapeo: { ...plantilla.mapeo } },
      ];
      escribir(destino, CLAVES.plantillas, plantillasMemoria);
    },
    async borrarPlantilla(id) {
      plantillasMemoria = plantillasMemoria.filter((plantilla) => plantilla.id !== id);
      escribir(destino, CLAVES.plantillas, plantillasMemoria);
    },
    async guardarResumen(resumen) {
      resumenesMemoria = [{ ...resumen }, ...resumenesMemoria].slice(0, 50);
      escribir(destino, CLAVES.resumenes, resumenesMemoria);
    },
    async listarResumenes() {
      return resumenesMemoria.map((resumen) => ({ ...resumen }));
    },
  };
}
