'use client';

import { useEffect, useState } from 'react';
import { MarcoAplicacion } from '@/components/app-shell';
import { useAplicacion } from '@/components/app-provider';
import type { ResumenGuardado } from '@/lib/dominio';

function porcentaje(valor: number): string {
  return new Intl.NumberFormat('es-UY', { style: 'percent', maximumFractionDigits: 1 }).format(valor);
}

function fechaLocal(valor: string | undefined): string {
  if (!valor) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor));
}

function estadoCierre(valor: boolean | null | undefined): string {
  if (valor === true) return 'Cierra';
  if (valor === false) return 'No cierra';
  return 'Sin verificar';
}

export default function PaginaHistorial() {
  const { almacen } = useAplicacion();
  const [resumenes, setResumenes] = useState<ResumenGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    void almacen
      .listarResumenes()
      .then((datos) => {
        if (activo) setResumenes(datos);
      })
      .catch((causa: unknown) => {
        if (activo) setError(causa instanceof Error ? causa.message : 'No se pudo leer el historial');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [almacen]);

  return (
    <MarcoAplicacion
      titulo="Historial"
      descripcion="Consultá los resultados agregados de conciliaciones anteriores. Los archivos y movimientos nunca se guardan."
    >
      <section className="app-panel" id="contenido">
        {cargando ? <p aria-live="polite">Cargando historial…</p> : null}
        {error ? <div className="error-box" role="alert">{error}</div> : null}
        {!cargando && !error && resumenes.length === 0 ? (
          <div className="empty-state"><h2>Todavía no hay conciliaciones</h2><p>Cuando termines una, vas a ver acá su resumen.</p></div>
        ) : null}
        <div className="history-list">
          {resumenes.map((resumen, indice) => (
            <article className="history-card" key={resumen.id ?? `${resumen.creadoEl ?? 'local'}-${indice}`}>
              <div>
                <p className="eyebrow">{resumen.periodo ?? 'Período no disponible'}</p>
                <h2>{resumen.nombreBanco ?? 'Conciliación local'}{resumen.moneda ? ` · ${resumen.moneda}` : ''}</h2>
                <p>{fechaLocal(resumen.creadoEl)}</p>
              </div>
              <dl>
                <div><dt>Conciliado</dt><dd>{porcentaje(resumen.porcentajeConciliadoCantidad)}</dd></div>
                <div><dt>Banco / planilla</dt><dd>{resumen.cantidadBanco} / {resumen.cantidadPlanilla}</dd></div>
                <div><dt>Dudosos</dt><dd>{resumen.dudosos}</dd></div>
                <div><dt>Cierre</dt><dd>{estadoCierre(resumen.cierreOk)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </MarcoAplicacion>
  );
}
