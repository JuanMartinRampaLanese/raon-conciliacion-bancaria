'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Estado, Movimiento, Regla, Resultado } from '@/lib/dominio';
import { useAplicacion } from '@/components/app-provider';
import { ETIQUETAS_ESTADO } from '@/lib/excel';
import { clientesUnicos, formatearFechaPantalla } from '@/lib/presentacion';

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
  const reglaSugeridaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!reglaSugerida) return;
    const id = requestAnimationFrame(() => {
      reglaSugeridaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      reglaSugeridaRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [reglaSugerida]);

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

  const aceptarCandidato = (resultadoId: string, indice: number) => {
    const sugerida = aceptar(resultadoId, indice);
    setReglaSugerida(sugerida ?? null);
    setMensaje(sugerida ? '' : 'Movimiento conciliado manualmente.');
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
        <article className={`summary-card ${datos.cierre.cierra === false ? 'alert' : datos.cierre.cierra ? 'ok' : 'warning'}`}><small>Cierre</small><strong>{datos.cierre.cierra === null ? 'Sin verificar' : datos.cierre.cierra ? 'Cierra' : 'No cierra'}</strong>{datos.cierre.diferenciaCentavos !== undefined ? <span className="summary-note">Diferencia {moneda(datos.cierre.diferenciaCentavos, datos.moneda)}</span> : null}</article>
        <article className={`summary-card funds-summary ${datos.fondos.alerta ? 'alert' : ''}`}>
          <small>Fondos y banco</small>
          <dl>
            <div><dt>Fondos de terceros</dt><dd>{moneda(datos.fondos.totalTercerosCentavos, datos.moneda)}</dd></div>
            <div><dt>Saldo en banco</dt><dd>{datos.fondos.saldoBancoCentavos === undefined ? 'Sin informar' : moneda(datos.fondos.saldoBancoCentavos, datos.moneda)}</dd></div>
            <div><dt>Diferencia</dt><dd>{datos.fondos.diferenciaCentavos === undefined ? 'Sin calcular' : moneda(datos.fondos.diferenciaCentavos, datos.moneda)}</dd></div>
          </dl>
        </article>
      </div>

      {datos.avisos.map((aviso) => <div className="warning-box" key={aviso}>{aviso}</div>)}
      {datos.cierre.cierra === false ? (
        <section className="error-box closure-alert" role="alert" aria-labelledby="cierre-alerta-titulo">
          <strong id="cierre-alerta-titulo">El cierre no coincide. Diferencia: {moneda(datos.cierre.diferenciaCentavos ?? 0, datos.moneda)}.</strong>
          {datos.cierre.cortes.length > 0 ? <><p>El saldo se corta en:</p><ul>{datos.cierre.cortes.map((corte) => <li key={corte.fila}>Fila {corte.fila}: informado {moneda(corte.informadoCentavos, datos.moneda)}, esperado {moneda(corte.esperadoCentavos, datos.moneda)} (diferencia {moneda(corte.diferenciaCentavos, datos.moneda)}).</li>)}</ul></> : null}
        </section>
      ) : datos.cierre.cierra === null ? <div className="warning-box" role="status">Cierre sin verificar. Informá saldos o mapeá la columna de saldo en una nueva conciliación.</div> : null}
      {datos.fondos.alerta ? <div className="error-box" role="alert">En el banco hay menos plata que la que se le debe a terceros</div> : null}
      {mensaje ? <div className="success-box" aria-live="polite">{mensaje}</div> : null}
      {reglaSugerida ? (
        <section className="rule-suggestion" aria-labelledby="regla-sugerida-titulo" ref={reglaSugeridaRef} tabIndex={-1}>
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
                <p className="mono">{movimiento ? moneda(movimiento.centavos, datos.moneda) : '—'} · {formatearFechaPantalla(movimiento?.fecha)}</p>
                <p>{resultado.nota}</p>
                {(resultado.candidatos ?? []).map((candidato, indice) => {
                  const candidatos = candidato.planilla.map((id) => planilla.get(id)).filter((item): item is Movimiento => Boolean(item));
                  return (
                    <div className="candidate" key={`${resultado.id}-${indice}`}>
                      <div><strong>{candidatos.map((item) => item.descripcion).join(' + ')}</strong><p>{clientesUnicos(candidatos) === '—' ? 'Sin cliente' : clientesUnicos(candidatos)}</p><p>{candidato.motivo}</p></div>
                      <div className="candidate-actions"><button className="button button-primary button-small" type="button" onClick={() => aceptarCandidato(resultado.id, indice)}>Aceptar</button></div>
                    </div>
                  );
                })}
                <button className="button button-danger button-small reject-all" type="button" onClick={() => rechazar(resultado.id)}>Ninguno coincide</button>
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
                return <tr key={resultado.id}><td><span className="state-chip">{ETIQUETAS_ESTADO[resultado.estado]}</span></td><td className="mono date-cell">{formatearFechaPantalla(principal?.fecha)}</td><td>{movimientos.map((item) => item.descripcion).join(' / ')}</td><td>{clientesUnicos(movimientos)}</td><td className="mono">{moneda(total, datos.moneda)}</td><td>{resultado.nota}</td></tr>;
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
