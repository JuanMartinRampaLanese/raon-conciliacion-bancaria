'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Estado, Movimiento, Regla, Resultado } from '@/lib/dominio';
import { useAplicacion } from '@/components/app-provider';
import { ETIQUETAS_ESTADO } from '@/lib/excel';

const ESTADOS: Estado[] = ['conciliado', 'conciliado_con_diferencia', 'dudoso', 'gasto_bancario', 'solo_banco', 'solo_planilla'];

function moneda(centavos: number, codigo: string): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: codigo,
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}

function movimientosDe(resultado: Resultado, banco: Map<string, Movimiento>, planilla: Map<string, Movimiento>) {
  return [
    ...resultado.banco.map((id) => banco.get(id)),
    ...resultado.planilla.map((id) => planilla.get(id)),
  ].filter((item): item is Movimiento => Boolean(item));
}

export function VistaResultados() {
  const { datos, aceptar, rechazar, descargar, almacen } = useAplicacion();
  const [pestana, setPestana] = useState<Estado | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [signo, setSigno] = useState('todos');
  const [reglaSugerida, setReglaSugerida] = useState<Regla | null>(null);
  const [mensaje, setMensaje] = useState('');

  const banco = new Map(datos?.movimientosBanco.map((item) => [item.id, item]) ?? []);
  const planilla = new Map(datos?.movimientosPlanilla.map((item) => [item.id, item]) ?? []);
  const resultados = (() => {
    if (!datos) return [];
    const termino = busqueda.trim().toLocaleLowerCase('es-UY');
    return datos.resultados.filter((resultado) => {
      if (pestana !== 'todos' && resultado.estado !== pestana) return false;
      const movimientos = movimientosDe(resultado, banco, planilla);
      if (signo === 'ingresos' && !movimientos.some((item) => item.centavos >= 0)) return false;
      if (signo === 'egresos' && !movimientos.some((item) => item.centavos < 0)) return false;
      if (!termino) return true;
      return movimientos.some((item) =>
        `${item.descripcion} ${item.cliente ?? ''} ${item.referencia ?? ''}`.toLocaleLowerCase('es-UY').includes(termino),
      ) || resultado.nota.toLocaleLowerCase('es-UY').includes(termino);
    });
  })();

  if (!datos) {
    return (
      <div className="app-panel empty-state" id="contenido">
        <h2>No hay una conciliación abierta</h2>
        <p>Los resultados se mantienen en memoria mientras navegás por esta sesión.</p>
        <Link className="button button-primary" href="/conciliar">Nueva conciliación</Link>
      </div>
    );
  }

  const guardarRegla = async () => {
    if (!reglaSugerida) return;
    await almacen.guardarRegla(reglaSugerida);
    setMensaje('Regla guardada en este navegador.');
    setReglaSugerida(null);
  };

  const descargarArchivo = async () => {
    try {
      setMensaje('Preparando el Excel…');
      await descargar();
      setMensaje('Excel descargado.');
    } catch (causa) {
      setMensaje(causa instanceof Error ? causa.message : 'No se pudo descargar el Excel');
    }
  };

  const porcentaje = new Intl.NumberFormat('es-UY', { style: 'percent', maximumFractionDigits: 1 }).format(datos.resumen.porcentajeConciliadoCantidad);

  return (
    <div className="app-panel" id="contenido">
      <div className="summary-grid">
        <article className="summary-card ok"><small>Conciliado</small><strong>{porcentaje}</strong></article>
        <article className={`summary-card ${datos.resumen.dudosos ? 'alert' : ''}`}><small>Dudosos</small><strong>{datos.resumen.dudosos}</strong></article>
        <article className="summary-card"><small>Solo en banco</small><strong>{datos.resumen.soloBanco}</strong></article>
        <article className="summary-card"><small>Solo en planilla</small><strong>{datos.resumen.soloPlanilla}</strong></article>
        <article className={`summary-card ${datos.cierre.cierra === false ? 'alert' : datos.cierre.cierra ? 'ok' : ''}`}><small>Cierre</small><strong>{datos.cierre.cierra === null ? 'Sin verificar' : datos.cierre.cierra ? 'Cierra' : 'No cierra'}</strong></article>
        <article className={`summary-card ${datos.fondos.alerta ? 'alert' : ''}`}><small>Fondos de terceros</small><strong>{moneda(datos.fondos.totalTercerosCentavos, datos.moneda)}</strong></article>
      </div>

      {datos.avisos.map((aviso) => <div className="warning-box" key={aviso}>{aviso}</div>)}
      {mensaje ? <div className="success-box" aria-live="polite">{mensaje}</div> : null}
      {reglaSugerida ? (
        <section className="rule-suggestion" aria-labelledby="regla-sugerida-titulo">
          <h2 id="regla-sugerida-titulo">Guardar una regla para la próxima vez</h2>
          <p>Podés editar el patrón antes de guardarlo. Se aplicará cuando el texto del banco lo contenga.</p>
          <div className="form-grid">
            <label className="field"><span>Patrón</span><input value={reglaSugerida.patron} onChange={(evento) => setReglaSugerida({ ...reglaSugerida, patron: evento.target.value })} /></label>
            <label className="field"><span>Cliente</span><input value={reglaSugerida.cliente ?? ''} onChange={(evento) => setReglaSugerida({ ...reglaSugerida, cliente: evento.target.value })} /></label>
          </div>
          <div className="button-row"><button className="button button-primary" type="button" onClick={() => void guardarRegla()}>Guardar regla</button><button className="button button-secondary" type="button" onClick={() => setReglaSugerida(null)}>Ahora no</button></div>
        </section>
      ) : null}

      <div className="results-toolbar">
        <div>
          <p className="eyebrow">{datos.nombreBanco} · {datos.periodo}</p>
          <h2 className="section-subtitle">Movimientos</h2>
        </div>
        <button className="button button-primary" type="button" onClick={() => void descargarArchivo()}>Descargar Excel <span aria-hidden="true">↓</span></button>
      </div>

      <div className="tabs" role="tablist" aria-label="Estados de la conciliación">
        <button className="tab" role="tab" aria-selected={pestana === 'todos'} onClick={() => setPestana('todos')}>Todos ({datos.resultados.length})</button>
        {ESTADOS.map((estado) => (
          <button className="tab" role="tab" aria-selected={pestana === estado} onClick={() => setPestana(estado)} key={estado}>{ETIQUETAS_ESTADO[estado]} ({datos.resultados.filter((item) => item.estado === estado).length})</button>
        ))}
      </div>
      <div className="results-filters">
        <label className="field"><span>Buscar</span><input className="search-input" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Descripción, cliente o referencia" /></label>
        <label className="field"><span>Tipo de movimiento</span><select className="filter-select" value={signo} onChange={(evento) => setSigno(evento.target.value)}><option value="todos">Ingresos y egresos</option><option value="ingresos">Ingresos</option><option value="egresos">Egresos</option></select></label>
      </div>

      {pestana === 'dudoso' ? (
        <div className="review-list">
          {resultados.map((resultado) => {
            const movimiento = banco.get(resultado.banco[0]);
            return (
              <article className="review-card" key={resultado.id}>
                <h3>{movimiento?.descripcion ?? resultado.id}</h3>
                <p className="mono">{movimiento ? moneda(movimiento.centavos, datos.moneda) : '—'} · {movimiento?.fecha}</p>
                <p>{resultado.nota}</p>
                {(resultado.candidatos ?? []).map((candidato, indice) => {
                  const candidatos = candidato.planilla.map((id) => planilla.get(id)).filter((item): item is Movimiento => Boolean(item));
                  return (
                    <div className="candidate" key={`${resultado.id}-${indice}`}>
                      <div><strong>{candidatos.map((item) => item.descripcion).join(' + ')}</strong><p>{candidatos.map((item) => item.cliente).filter(Boolean).join(', ') || 'Sin cliente'}</p><p>{candidato.motivo} · {Math.round(candidato.puntaje * 100)}%</p></div>
                      <div className="candidate-actions"><button className="button button-primary button-small" type="button" onClick={() => setReglaSugerida(aceptar(resultado.id, indice) ?? null)}>Aceptar</button><button className="button button-danger button-small" type="button" onClick={() => rechazar(resultado.id)}>Rechazar</button></div>
                    </div>
                  );
                })}
                {(resultado.candidatos?.length ?? 0) === 0 ? <button className="button button-danger button-small" type="button" onClick={() => rechazar(resultado.id)}>Rechazar</button> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Estado</th><th>Fecha</th><th>Descripción</th><th>Cliente</th><th>Monto</th><th>Nota</th></tr></thead>
            <tbody>
              {resultados.map((resultado) => {
                const movimientos = movimientosDe(resultado, banco, planilla);
                const principal = movimientos[0];
                const total = (resultado.banco.length ? resultado.banco.map((id) => banco.get(id)) : resultado.planilla.map((id) => planilla.get(id))).filter((item): item is Movimiento => Boolean(item)).reduce((suma, item) => suma + item.centavos, 0);
                return <tr key={resultado.id}><td><span className="state-chip">{ETIQUETAS_ESTADO[resultado.estado]}</span></td><td className="mono">{principal?.fecha ?? '—'}</td><td>{movimientos.map((item) => item.descripcion).join(' / ')}</td><td>{movimientos.map((item) => item.cliente).filter(Boolean).join(', ') || '—'}</td><td className="mono">{moneda(total, datos.moneda)}</td><td>{resultado.nota}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-subtitle">Fondos por cliente</h2>
      <p>Fondos de terceros: {moneda(datos.fondos.totalTercerosCentavos, datos.moneda)} · Saldo en banco: {datos.fondos.saldoBancoCentavos === undefined ? 'sin informar' : moneda(datos.fondos.saldoBancoCentavos, datos.moneda)} · Diferencia: {datos.fondos.diferenciaCentavos === undefined ? 'sin calcular' : moneda(datos.fondos.diferenciaCentavos, datos.moneda)}</p>
      <div className="table-scroll funds-table"><table className="data-table"><thead><tr><th>Cliente</th><th>Cobrado</th><th>Pagado</th><th>Saldo</th><th>Conciliado</th><th>Pendiente</th></tr></thead><tbody>{datos.fondos.clientes.map((cliente) => <tr key={cliente.cliente}><td>{cliente.cliente}</td><td className="mono">{moneda(cliente.cobradoCentavos, datos.moneda)}</td><td className="mono">{moneda(cliente.pagadoCentavos, datos.moneda)}</td><td className="mono">{moneda(cliente.saldoCentavos, datos.moneda)}</td><td className="mono">{moneda(cliente.conciliadoCentavos, datos.moneda)}</td><td className="mono">{moneda(cliente.pendienteCentavos, datos.moneda)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
