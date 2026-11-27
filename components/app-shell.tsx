import Link from 'next/link';
import type { ReactNode } from 'react';

export function Marca() {
  return (
    <Link className="brand" href="/" aria-label="RAON, inicio">
      <span className="brand-mark" aria-hidden="true" />
      <span>RAON</span>
    </Link>
  );
}

export function Cabecera() {
  return (
    <header className="site-header nav">
      <div className="wrap nav-bar">
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <Marca />
        <nav className="nav-links" aria-label="Navegación principal">
          <Link href="/conciliar">Conciliar</Link>
          <Link href="/reglas">Reglas</Link>
        </nav>
        <Link className="button button-primary button-small" href="/conciliar">
          Nueva conciliación
        </Link>
      </div>
    </header>
  );
}

export function Pie() {
  return (
    <footer className="site-footer closing">
      <div className="wrap">
        <div className="closing-cta">
          <h2>Prepará la próxima conciliación</h2>
          <Link className="button button-primary" href="/conciliar">Nueva conciliación <span aria-hidden="true">→</span></Link>
        </div>
        <div className="closing-links">
          <div className="footer-grid">
            <div><Marca /><p>Conciliación bancaria para fondos de terceros.</p></div>
            <nav aria-label="Navegación del pie"><Link href="/conciliar">Nueva conciliación</Link><Link href="/reglas">Reglas y plantillas</Link></nav>
          </div>
          <p className="footer-legal">© 2026 RAON. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

export function MarcoAplicacion({
  children,
  titulo,
  descripcion,
}: {
  children: ReactNode;
  titulo: string;
  descripcion: string;
}) {
  return (
    <>
      <Cabecera />
      <main className="app-main">
        <div className="wrap app-heading">
          <p className="eyebrow">Conciliación bancaria</p>
          <h1>{titulo}</h1>
          <p>{descripcion}</p>
        </div>
        {children}
      </main>
    </>
  );
}
