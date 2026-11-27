import { MarcoAplicacion } from '@/components/app-shell';
import { AdministradorReglas } from '@/components/administrador-reglas';

export default function PaginaReglas() {
  return (
    <MarcoAplicacion
      titulo="Reglas y plantillas"
      descripcion="Estos datos se guardan únicamente en este navegador y se reutilizan en las próximas conciliaciones."
    >
      <AdministradorReglas />
    </MarcoAplicacion>
  );
}
