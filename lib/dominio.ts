export type Origen = 'banco' | 'planilla';
export type Moneda = 'UYU' | 'USD' | 'ARS' | 'EUR';

export interface Movimiento {
  id: string;
  origen: Origen;
  fecha: string;
  descripcion: string;
  texto: string;
  centavos: number;
  moneda: Moneda;
  cliente?: string;
  referencia?: string;
  tipo?: 'tercero' | 'propio';
  saldoCentavos?: number;
  fila: number;
}

export type Estado =
  | 'conciliado'
  | 'conciliado_con_diferencia'
  | 'gasto_bancario'
  | 'dudoso'
  | 'solo_banco'
  | 'solo_planilla';

export type Paso = 'exacto' | 'tolerancia' | 'uno_a_muchos' | 'muchos_a_uno' | 'regla' | 'manual';

export interface Candidato {
  planilla: string[];
  puntaje: number;
  motivo: string;
}

export interface Resultado {
  id: string;
  estado: Estado;
  paso?: Paso;
  banco: string[];
  planilla: string[];
  diferenciaCentavos: number;
  puntaje: number;
  nota: string;
  candidatos?: Candidato[];
  sugerenciaIA?: { indice: number | null; confianza: number; motivo: string };
}

export interface Regla {
  id: string;
  patron: string;
  accion: 'asignar_cliente' | 'gasto_bancario';
  cliente?: string;
  origen: 'por_defecto' | 'manual' | 'revision';
}

export interface ConfigMotor {
  ventanaDias: number;
  ventanaAgrupadoDias: number;
  toleranciaPct: number;
  toleranciaMaxCentavos: number;
  similitudMin: number;
  maxAgrupados: number;
  puntajeMinDudoso: number;
}

export interface Resumen {
  cantidadBanco: number;
  cantidadPlanilla: number;
  conciliados: number;
  dudosos: number;
  soloBanco: number;
  soloPlanilla: number;
  gastosBancarios: number;
  porcentajeConciliadoCantidad: number;
  porcentajeConciliadoMonto: number;
  totalesPorEstado: Partial<Record<Estado, { cantidad: number; centavos: number }>>;
}

export interface PlantillaBanco {
  id: string;
  banco: string;
  mapeo: MapeoColumnas;
}

export interface MapeoColumnas {
  fecha?: string;
  descripcion?: string;
  debito?: string;
  credito?: string;
  importe?: string;
  saldo?: string;
  cliente?: string;
  referencia?: string;
  moneda?: string;
  tipo?: string;
}

export interface FilaCruda {
  numero: number;
  valores: Record<string, unknown>;
}
