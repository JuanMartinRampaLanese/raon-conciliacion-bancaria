'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAplicacion } from '@/components/app-provider';
import type { PlantillaBanco, Regla } from '@/lib/dominio';
import { CAMPOS_MAPEO } from '@/lib/mapeo';

export function AdministradorReglas() {
  const { almacen } = useAplicacion();
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaBanco[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [nueva, setNueva] = useState<Regla>({ id: '', patron: '', accion: 'asignar_cliente', cliente: '', origen: 'manual' });

  const recargar = useCallback(async () => {
    const [listaReglas, listaPlantillas] = await Promise.all([almacen.listarReglas(), almacen.listarPlantillas()]);
    setReglas(listaReglas);
    setPlantillas(listaPlantillas);
  }, [almacen]);
  useEffect(() => {
    let activo = true;
    void Promise.all([almacen.listarReglas(), almacen.listarPlantillas()]).then(
      ([listaReglas, listaPlantillas]) => {
        if (!activo) return;
        setReglas(listaReglas);
        setPlantillas(listaPlantillas);
      },
    );
    return () => { activo = false; };
  }, [almacen]);

  const guardarRegla = async (regla: Regla) => {
    await almacen.guardarRegla(regla);
    setMensaje('Regla guardada.');
    await recargar();
  };
  const guardarPlantilla = async (plantilla: PlantillaBanco) => {
    await almacen.guardarPlantilla(plantilla);
    setMensaje('Plantilla guardada.');
    await recargar();
  };

  return (
    <div className="app-panel rules-layout" id="contenido">
      {mensaje ? <div className="success-box" aria-live="polite">{mensaje}</div> : null}
      <section className="rules-section" aria-labelledby="reglas-titulo">
        <h2 id="reglas-titulo">Reglas ({reglas.length})</h2>
        <p>Las reglas de cliente agregan información al movimiento. Las de gasto bancario solo actúan sobre egresos sin conciliar.</p>
        <div className="editable-row">
          <label className="field"><span>Patrón nuevo</span><input value={nueva.patron} onChange={(evento) => setNueva({ ...nueva, patron: evento.target.value })} /></label>
          <label className="field"><span>Acción</span><select value={nueva.accion} onChange={(evento) => setNueva({ ...nueva, accion: evento.target.value as Regla['accion'] })}><option value="asignar_cliente">Asignar cliente</option><option value="gasto_bancario">Gasto bancario</option></select></label>
          <label className="field"><span>Cliente</span><input disabled={nueva.accion === 'gasto_bancario'} value={nueva.cliente ?? ''} onChange={(evento) => setNueva({ ...nueva, cliente: evento.target.value })} /></label>
          <button className="button button-primary button-small" type="button" disabled={!nueva.patron.trim()} onClick={() => void guardarRegla({ ...nueva, id: `RM-${Date.now()}`, patron: nueva.patron.trim().toUpperCase(), cliente: nueva.accion === 'gasto_bancario' ? undefined : nueva.cliente })}>Agregar</button>
        </div>
        {reglas.map((regla) => (
          <div className="editable-row" key={regla.id}>
            <label className="field"><span>Patrón</span><input value={regla.patron} onChange={(evento) => setReglas((actual) => actual.map((item) => item.id === regla.id ? { ...item, patron: evento.target.value } : item))} /></label>
            <label className="field"><span>Acción</span><select value={regla.accion} onChange={(evento) => setReglas((actual) => actual.map((item) => item.id === regla.id ? { ...item, accion: evento.target.value as Regla['accion'] } : item))}><option value="asignar_cliente">Asignar cliente</option><option value="gasto_bancario">Gasto bancario</option></select></label>
            <label className="field"><span>Cliente</span><input disabled={regla.accion === 'gasto_bancario'} value={regla.cliente ?? ''} onChange={(evento) => setReglas((actual) => actual.map((item) => item.id === regla.id ? { ...item, cliente: evento.target.value } : item))} /></label>
            <div className="button-row"><button className="button button-primary button-small" type="button" onClick={() => void guardarRegla(regla)}>Guardar</button><button className="button button-danger button-small" type="button" onClick={() => void almacen.borrarRegla(regla.id).then(recargar)}>Borrar</button></div>
          </div>
        ))}
      </section>

      <section className="rules-section" aria-labelledby="plantillas-titulo">
        <h2 id="plantillas-titulo">Plantillas de banco ({plantillas.length})</h2>
        {plantillas.length === 0 ? <p>Todavía no hay plantillas. Se crean al completar una conciliación.</p> : null}
        {plantillas.map((plantilla) => (
          <article className="template-card" key={plantilla.id}>
            <div className="template-title">
              <label className="field"><span>Nombre</span><input value={plantilla.banco} onChange={(evento) => setPlantillas((actual) => actual.map((item) => item.id === plantilla.id ? { ...item, banco: evento.target.value } : item))} /></label>
              <div className="button-row"><button className="button button-primary button-small" type="button" onClick={() => void guardarPlantilla(plantilla)}>Guardar</button><button className="button button-danger button-small" type="button" onClick={() => void almacen.borrarPlantilla(plantilla.id).then(recargar)}>Borrar</button></div>
            </div>
            <div className="template-mapping">
              {CAMPOS_MAPEO.map(({ clave, etiqueta }) => <label className="field" key={clave}><span>{etiqueta}</span><input value={plantilla.mapeo[clave] ?? ''} onChange={(evento) => setPlantillas((actual) => actual.map((item) => item.id === plantilla.id ? { ...item, mapeo: { ...item.mapeo, [clave]: evento.target.value || undefined } } : item))} /></label>)}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
