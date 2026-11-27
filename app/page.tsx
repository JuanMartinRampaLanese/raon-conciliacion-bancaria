import Link from 'next/link';
import { Cabecera, Pie } from '@/components/app-shell';

function VistaProducto() {
  return (
    <div className="product-stage" role="img" aria-label="Resumen de una conciliación de ejemplo">
      <div className="product-window">
        <div className="window-bar">
          <span />
          <span />
          <span />
          <b>Conciliación · Octubre 2026</b>
        </div>
        <div className="window-body">
          <aside>
            <strong>Resumen</strong>
            <span>Conciliados</span>
            <span>Dudosos</span>
            <span>Solo banco</span>
            <span>Fondos</span>
          </aside>
          <div className="window-main">
            <div className="window-title">
              <div>
                <small>Banco de ejemplo</small>
                <h3>Movimientos conciliados</h3>
              </div>
              <strong>91,0%</strong>
            </div>
            <div className="metric-row">
              <div><small>Conciliados</small><b>61</b></div>
              <div><small>Dudosos</small><b>2</b></div>
              <div><small>Solo banco</small><b>3</b></div>
            </div>
            <div className="mock-table">
              <div className="mock-row mock-head"><span>Movimiento</span><span>Cliente</span><span>Estado</span></div>
              <div className="mock-row"><span>Alquiler octubre</span><span>Pérez</span><span className="status status-ok">Conciliado</span></div>
              <div className="mock-row"><span>Transferencia 4471</span><span>Gómez</span><span className="status status-warn">Revisar</span></div>
              <div className="mock-row"><span>IVA comisión</span><span>—</span><span className="status status-rule">Gasto</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="process-note" aria-hidden="true">
        <small>Procesado en este navegador</small>
        <span><i>✓</i> Archivos sin subir</span>
        <span><i>✓</i> Excel listo</span>
      </div>
    </div>
  );
}

export default function PaginaInicial() {
  const modoDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  return (
    <>
      <Cabecera />
      <main id="contenido">
        <section className="landing-hero hero" data-enter aria-labelledby="titulo-principal">
          <div className="wrap"><div className="hero-text hero-grid">
            <div className="hero-copy">
              {modoDemo ? <p className="demo-banner">Modo demo · datos completamente inventados</p> : null}
              <h1 id="titulo-principal">Conciliación bancaria para fondos de terceros</h1>
              <p className="hero-lead">
                Cruzá el extracto con tu planilla, revisá las excepciones y sabé cuánto dinero
                corresponde a cada cliente. El resultado queda listo para descargar en Excel.
              </p>
              <p className="hero-fact">67 movimientos ficticios listos para probar el flujo completo.</p>
              <div className="button-row">
                <Link className="button button-primary" href="/conciliar">
                  Nueva conciliación <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" href="/conciliar?demo=1">
                  Probar con datos de ejemplo
                </Link>
              </div>
              <p className="privacy-line">
                Tus archivos se procesan en tu navegador y no se
                suben a ningún servidor.
              </p>
            </div>
            <VistaProducto />
          </div></div>
        </section>

        <section className="landing-section section-light" aria-labelledby="flujo-titulo">
          <div className="wrap">
            <div className="section-heading">
              <p className="eyebrow">Un recorrido verificable</p>
              <h2 id="flujo-titulo">Tres pasos para conciliar movimientos</h2>
              <p>La herramienta muestra cómo interpretó cada dato antes de hacer el cruce.</p>
            </div>
            <div className="steps-grid">
              <article><span>01</span><h3>Extracto bancario</h3><p>Subí un CSV o XLSX con detección automática de encabezados y formato.</p><div className="step-visual visual-file" role="img" aria-label="Archivo CSV leído en el navegador"><i>CSV</i><b>67 filas</b></div></article>
              <article><span>02</span><h3>Mapeo de columnas bancarias</h3><p>Confirmá fecha, monto, moneda y columnas antes de procesar.</p><div className="step-visual visual-map" role="img" aria-label="Columnas crudas e interpretadas"><i>Fecha</i><b>24/11 → 2026-11-24</b></div></article>
              <article><span>03</span><h3>Revisión de movimientos dudosos</h3><p>Aceptá dudosos, guardá reglas y descargá el Excel final.</p><div className="step-visual visual-review" role="img" aria-label="Caso dudoso listo para revisar"><i>Dudoso</i><b>Aceptar o rechazar</b></div></article>
            </div>
          </div>
        </section>

        <section className="landing-section privacy-section" aria-labelledby="privacidad-titulo">
          <div className="wrap privacy-grid">
            <div>
              <p className="eyebrow">Privacidad por diseño</p>
              <h2 id="privacidad-titulo">Privacidad para los movimientos conciliados</h2>
            </div>
            <div className="privacy-copy">
              <p>
                La lectura, el cruce y la generación del Excel corren en un Web Worker dentro del
                navegador. La app local solo guarda reglas y plantillas de columnas.
              </p>
              <dl>
                <div><dt>Archivos</dt><dd>Solo en memoria</dd></div>
                <div><dt>Movimientos</dt><dd>No se guardan</dd></div>
                <div><dt>Reglas</dt><dd>En este navegador</dd></div>
              </dl>
              <div className="privacy-diagram panel" role="img" aria-label="Los archivos entran al navegador y el Excel sale sin pasar por un servidor">
                <span>CSV / XLSX</span><i>→</i><strong>Navegador</strong><i>→</i><span>Excel</span>
              </div>
              <Link className="button button-primary" href="/conciliar">Nueva conciliación <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>
      </main>
      <Pie />
    </>
  );
}
