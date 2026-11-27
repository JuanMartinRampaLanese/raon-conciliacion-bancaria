import { MarcoAplicacion } from '@/components/app-shell';
import { AsistenteConciliacion } from '@/components/asistente-conciliacion';

export default async function PaginaConciliar({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const parametros = await searchParams;
  return (
    <MarcoAplicacion
      titulo="Nueva conciliación"
      descripcion="Confirmá qué representa cada columna antes de procesar. Los archivos permanecen en este navegador."
    >
      <AsistenteConciliacion cargarDemo={parametros.demo === '1'} />
    </MarcoAplicacion>
  );
}
