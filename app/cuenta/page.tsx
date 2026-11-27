import { AccesoCuenta } from '@/components/acceso-cuenta';
import { z } from 'zod';
import { MarcoAplicacion } from '@/components/app-shell';
import { supabaseEstaConfigurado } from '@/lib/supabase/config';

const ParametrosCuenta = z.object({ error: z.union([z.string(), z.array(z.string())]).optional() });

export default async function PaginaCuenta({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const resultado = ParametrosCuenta.safeParse(await searchParams);
  const valorError = resultado.success ? resultado.data.error : undefined;
  const error = Array.isArray(valorError) ? valorError[0] : valorError;
  return (
    <MarcoAplicacion
      titulo="Cuenta"
      descripcion="Accedé por email para compartir la configuración y conservar el historial resumido de tu organización."
    >
      <AccesoCuenta configurado={supabaseEstaConfigurado()} errorInicial={error} />
    </MarcoAplicacion>
  );
}
