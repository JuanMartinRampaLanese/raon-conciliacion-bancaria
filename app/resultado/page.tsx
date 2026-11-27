import { MarcoAplicacion } from '@/components/app-shell';
import { VistaResultados } from '@/components/vista-resultados';

export default function PaginaResultado() {
  return (
    <MarcoAplicacion
      titulo="Resultado"
      descripcion="Revisá los cruces, resolvé los casos dudosos y descargá el libro de trabajo."
    >
      <VistaResultados />
    </MarcoAplicacion>
  );
}
