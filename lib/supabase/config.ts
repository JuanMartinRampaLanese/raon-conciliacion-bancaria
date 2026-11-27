export interface VariablesPublicasSupabase {
  url?: string;
  clavePublicable?: string;
  claveAnonima?: string;
}

export interface ConfiguracionSupabase {
  url: string;
  clavePublica: string;
}

const MARCADORES_FICTICIOS = [
  'proyecto-falso',
  'clave-falsa',
  'clave-publica-falsa',
  'example.supabase',
  'tu-proyecto',
  'your-project',
];

function valorUtil(valor: string | undefined): string | null {
  const limpio = valor?.trim();
  if (!limpio) return null;
  const normalizado = limpio.toLocaleLowerCase('es-UY');
  return MARCADORES_FICTICIOS.some((marcador) => normalizado.includes(marcador)) ? null : limpio;
}

function esUrlValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

export function variablesPublicasSupabase(): VariablesPublicasSupabase {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    clavePublicable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    claveAnonima: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function resolverConfiguracionSupabase(
  variables: VariablesPublicasSupabase = variablesPublicasSupabase(),
): ConfiguracionSupabase | null {
  const url = valorUtil(variables.url);
  const clavePublica = valorUtil(variables.clavePublicable) ?? valorUtil(variables.claveAnonima);
  if (!url || !clavePublica || !esUrlValida(url)) return null;
  return { url: url.replace(/\/$/, ''), clavePublica };
}

export function supabaseEstaConfigurado(): boolean {
  return resolverConfiguracionSupabase() !== null;
}
