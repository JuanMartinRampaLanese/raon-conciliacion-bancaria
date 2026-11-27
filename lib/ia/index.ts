import type { RespuestaIA, SolicitudIA } from '@/lib/ia/esquemas';

export interface ProveedorIA {
  sugerir(solicitud: SolicitudIA, signal: AbortSignal): Promise<RespuestaIA>;
}

export interface VariablesIA {
  habilitada?: string;
  modelo?: string;
  claveGemini?: string;
}

export interface ConfiguracionIA {
  modelo: string;
  claveGemini: string;
}

const MARCADORES_FICTICIOS = ['modelo-falso', 'clave-falsa', 'no-usar', 'example', 'tu-clave'];

function valorUtil(valor: string | undefined): string | null {
  const limpio = valor?.trim();
  if (!limpio) return null;
  const normalizado = limpio.toLocaleLowerCase('es-UY');
  return MARCADORES_FICTICIOS.some((marcador) => normalizado.includes(marcador)) ? null : limpio;
}

export function variablesIA(): VariablesIA {
  return {
    habilitada: process.env.AI_ENABLED,
    modelo: process.env.AI_MODEL,
    claveGemini: process.env.GEMINI_API_KEY,
  };
}

export function iaFueHabilitada(variables: VariablesIA = variablesIA()): boolean {
  return variables.habilitada?.trim().toLocaleLowerCase('en-US') === 'true';
}

export function resolverConfiguracionIA(
  variables: VariablesIA = variablesIA(),
): ConfiguracionIA | null {
  if (!iaFueHabilitada(variables)) return null;
  const modelo = valorUtil(variables.modelo);
  const claveGemini = valorUtil(variables.claveGemini);
  return modelo && claveGemini ? { modelo, claveGemini } : null;
}
