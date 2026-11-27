'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MapeoColumnas, Moneda, PlantillaBanco } from '@/lib/dominio';
import { useAplicacion } from '@/components/app-provider';
import { pedirPrevisualizacion } from '@/lib/worker/cliente';
import type { ArchivoBytes, PrevisualizacionArchivo } from '@/lib/worker/protocolo';
import { interpretarFilas } from '@/lib/vista-previa';
import { CAMPOS_MAPEO } from '@/lib/mapeo';
import { parsearMonto } from '@/lib/normalizar';
import { formatearFechaPantalla } from '@/lib/presentacion';

async function archivoDesdeFile(archivo: File): Promise<ArchivoBytes> {
  return { nombre: archivo.name, bytes: new Uint8Array(await archivo.arrayBuffer()) };
}

function nombrePlantilla(nombreBanco: string): string {
  return `plantilla-${nombreBanco.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'banco'}`;
}

function VistaMapeo({
  titulo,
  vista,
  mapeo,
  moneda,
  origen,
  alCambiar,
}: {
  titulo: string;
  vista: PrevisualizacionArchivo;
  mapeo: MapeoColumnas;
  moneda: Moneda;
  origen: 'banco' | 'planilla';
  alCambiar: (campo: keyof MapeoColumnas, valor: string) => void;
}) {
  const filas = interpretarFilas({ filas: vista.filas, mapeo, origen, moneda });
  const formatoMonto = new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  });
  return (
    <section className="mapping-card" aria-labelledby={`mapeo-${origen}`}>
      <h2 id={`mapeo-${origen}`}>{titulo}</h2>
      <div className="mapping-list">
        {CAMPOS_MAPEO.filter(({ clave }) =>
          origen === 'banco' ? clave !== 'tipo' : clave !== 'saldo',
        ).map(({ clave, etiqueta }) => (
          <label className="mapping-row" key={clave}>
            <span>{etiqueta}</span>
            <select value={mapeo[clave] ?? ''} onChange={(evento) => alCambiar(clave, evento.target.value)}>
              <option value="">No usar</option>
              {vista.encabezados.map((encabezado) => (
                <option value={encabezado} key={encabezado}>{encabezado}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="table-scroll">
        <table className="preview-table">
          <thead><tr><th>Fila</th><th>Fecha cruda</th><th>Fecha interpretada</th><th>Monto crudo</th><th>Monto interpretado</th></tr></thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.fila}>
                <td>{fila.fila}</td>
                <td>{String(fila.fechaCruda ?? '')}</td>
                <td className={fila.error ? 'interpreted-error' : 'interpreted'}>{fila.error ?? formatearFechaPantalla(fila.fecha)}</td>
                <td>{String(fila.montoCrudo ?? '')}</td>
                <td className={fila.error ? 'interpreted-error' : 'interpreted'}>
                  {fila.centavos === undefined ? '—' : formatoMonto.format(fila.centavos / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AsistenteConciliacion({ cargarDemo }: { cargarDemo: boolean }) {
  const router = useRouter();
  const { almacen, conciliar, progreso } = useAplicacion();
  const [paso, setPaso] = useState(1);
  const [banco, setBanco] = useState<ArchivoBytes | null>(null);
  const [planilla, setPlanilla] = useState<ArchivoBytes | null>(null);
  const [nombreBanco, setNombreBanco] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('UYU');
  const [vistaBanco, setVistaBanco] = useState<PrevisualizacionArchivo | null>(null);
  const [vistaPlanilla, setVistaPlanilla] = useState<PrevisualizacionArchivo | null>(null);
  const [mapeoBanco, setMapeoBanco] = useState<MapeoColumnas>({});
  const [mapeoPlanilla, setMapeoPlanilla] = useState<MapeoColumnas>({});
  const [plantillas, setPlantillas] = useState<PlantillaBanco[]>([]);
  const [plantillaId, setPlantillaId] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [saldoFinal, setSaldoFinal] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const demoIniciado = useRef(false);

  useEffect(() => {
    void almacen.listarPlantillas().then(setPlantillas);
  }, [almacen]);

  useEffect(() => {
    if (!cargarDemo || demoIniciado.current) return;
    demoIniciado.current = true;
    void (async () => {
      setCargando(true);
      try {
        const [respuestaBanco, respuestaPlanilla] = await Promise.all([
          fetch('/demo/banco.csv'),
          fetch('/demo/planilla.csv'),
        ]);
        if (!respuestaBanco.ok || !respuestaPlanilla.ok) throw new Error('No se pudieron cargar los archivos de ejemplo');
        const archivoBanco: ArchivoBytes = { nombre: 'banco-demo.csv', bytes: new Uint8Array(await respuestaBanco.arrayBuffer()) };
        const archivoPlanilla: ArchivoBytes = { nombre: 'planilla-demo.csv', bytes: new Uint8Array(await respuestaPlanilla.arrayBuffer()) };
        const [preBanco, prePlanilla] = await Promise.all([
          pedirPrevisualizacion({ tipo: 'previsualizar', archivo: archivoBanco }),
          pedirPrevisualizacion({ tipo: 'previsualizar', archivo: archivoPlanilla }),
        ]);
        setBanco(archivoBanco);
        setPlanilla(archivoPlanilla);
        setNombreBanco('Banco demo');
        setVistaBanco(preBanco);
        setVistaPlanilla(prePlanilla);
        setMapeoBanco(preBanco.mapeoDetectado);
        setMapeoPlanilla(prePlanilla.mapeoDetectado);
        setPaso(3);
      } catch (causa) {
        setError(causa instanceof Error ? causa.message : 'No se pudo cargar el modo demo');
      } finally {
        setCargando(false);
      }
    })();
  }, [cargarDemo]);

  const cambiarPlantilla = (id: string) => {
    setPlantillaId(id);
    const plantilla = plantillas.find((item) => item.id === id);
    if (plantilla) {
      setNombreBanco(plantilla.banco);
      setMapeoBanco(plantilla.mapeo);
    }
  };

  const prepararVista = async () => {
    if (!banco || !planilla) return;
    setCargando(true);
    setError('');
    try {
      const [preBanco, prePlanilla] = await Promise.all([
        pedirPrevisualizacion({ tipo: 'previsualizar', archivo: banco }),
        pedirPrevisualizacion({ tipo: 'previsualizar', archivo: planilla }),
      ]);
      setVistaBanco(preBanco);
      setVistaPlanilla(prePlanilla);
      setMapeoBanco((actual) => ({ ...preBanco.mapeoDetectado, ...actual }));
      setMapeoPlanilla((actual) => ({ ...prePlanilla.mapeoDetectado, ...actual }));
      setPaso(3);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudieron leer los archivos');
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async () => {
    if (!banco || !planilla || !vistaBanco || !vistaPlanilla || !nombreBanco.trim()) return;
    setError('');
    setCargando(true);
    try {
      const haySaldoManual = saldoInicial.trim() || saldoFinal.trim();
      if (haySaldoManual && (!saldoInicial.trim() || !saldoFinal.trim())) {
        throw new Error('Completá el saldo inicial y el saldo final, o dejá ambos vacíos');
      }
      const saldosManuales = haySaldoManual
        ? {
            inicialCentavos: parsearMonto(saldoInicial),
            finalCentavos: parsearMonto(saldoFinal),
          }
        : undefined;
      const reglas = await almacen.listarReglas();
      const plantilla: PlantillaBanco = {
        id: plantillaId || nombrePlantilla(nombreBanco),
        banco: nombreBanco.trim(),
        mapeo: mapeoBanco,
      };
      await almacen.guardarPlantilla(plantilla);
      await conciliar({ banco, planilla, mapeoBanco, mapeoPlanilla, nombreBanco: nombreBanco.trim(), moneda, reglas, saldosManuales });
      router.push('/resultado');
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo completar la conciliación');
    } finally {
      setCargando(false);
    }
  };

  const puedeAvanzarPaso1 = Boolean(banco && nombreBanco.trim());
  const puedeConciliar = useMemo(
    () => Boolean(mapeoBanco.fecha && mapeoBanco.descripcion && (mapeoBanco.importe || mapeoBanco.debito || mapeoBanco.credito) && mapeoPlanilla.fecha && mapeoPlanilla.descripcion && (mapeoPlanilla.importe || mapeoPlanilla.debito || mapeoPlanilla.credito)),
    [mapeoBanco, mapeoPlanilla],
  );

  return (
    <div className="app-panel" id="contenido">
      <div className="stepper" aria-label={`Paso ${paso} de 3`}>
        {['Extracto', 'Planilla', 'Confirmar columnas'].map((etiqueta, indice) => (
          <div className={paso === indice + 1 ? 'active' : paso > indice + 1 ? 'done' : ''} key={etiqueta}>
            {indice + 1}. {etiqueta}
          </div>
        ))}
      </div>

      {cargarDemo ? <div className="warning-box">Modo demo: estos movimientos y clientes son completamente inventados.</div> : null}
      {error ? <div className="error-box" role="alert">{error}</div> : null}

      {paso === 1 ? (
        <div className="form-grid">
          <div className="field field-full file-drop">
            <label htmlFor="archivo-banco">Extracto bancario (.csv o .xlsx)</label>
            <input id="archivo-banco" type="file" accept=".csv,.xlsx,.xls" onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) void archivoDesdeFile(archivo).then(setBanco);
            }} />
            <small>{banco ? banco.nombre : 'Hasta 10 MB y 20.000 filas.'}</small>
          </div>
          <label className="field">
            <span>Banco o cuenta</span>
            <input value={nombreBanco} onChange={(evento) => setNombreBanco(evento.target.value)} placeholder="Ej.: BROU alquileres" />
          </label>
          <label className="field">
            <span>Moneda</span>
            <select value={moneda} onChange={(evento) => setMoneda(evento.target.value as Moneda)}>
              <option value="UYU">Pesos uruguayos (UYU)</option><option value="USD">Dólares (USD)</option><option value="ARS">Pesos argentinos (ARS)</option><option value="EUR">Euros (EUR)</option>
            </select>
          </label>
          <label className="field field-full">
            <span>Plantilla guardada</span>
            <select value={plantillaId} onChange={(evento) => cambiarPlantilla(evento.target.value)}>
              <option value="">Detectar columnas automáticamente</option>
              {plantillas.map((plantilla) => <option value={plantilla.id} key={plantilla.id}>{plantilla.banco}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {paso === 2 ? (
        <div className="form-grid">
          <div className="field field-full file-drop">
            <label htmlFor="archivo-planilla">Planilla del negocio (.csv o .xlsx)</label>
            <input id="archivo-planilla" type="file" accept=".csv,.xlsx,.xls" onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) void archivoDesdeFile(archivo).then(setPlanilla);
            }} />
            <small>{planilla ? planilla.nombre : 'Debe incluir fecha, descripción y monto o debe/haber.'}</small>
          </div>
        </div>
      ) : null}

      {paso === 3 && vistaBanco && vistaPlanilla ? (
        <>
          {!mapeoBanco.saldo ? (
            <section className="manual-balances" aria-labelledby="saldos-manuales-titulo">
              <div>
                <h2 id="saldos-manuales-titulo">Saldos del extracto (opcional)</h2>
                <p>Completá ambos para verificar el cierre si el archivo no incluye una columna de saldo.</p>
              </div>
              <div className="form-grid">
                <label className="field"><span>Saldo inicial</span><input inputMode="decimal" value={saldoInicial} onChange={(evento) => setSaldoInicial(evento.target.value)} placeholder="Ej.: 50.000,00" /></label>
                <label className="field"><span>Saldo final</span><input inputMode="decimal" value={saldoFinal} onChange={(evento) => setSaldoFinal(evento.target.value)} placeholder="Ej.: 125.430,00" /></label>
              </div>
            </section>
          ) : null}
          <div className="mapping-grid">
            <VistaMapeo titulo={`Extracto · ${vistaBanco.totalFilas} filas`} vista={vistaBanco} mapeo={mapeoBanco} moneda={moneda} origen="banco" alCambiar={(campo, valor) => setMapeoBanco((actual) => ({ ...actual, [campo]: valor || undefined }))} />
            <VistaMapeo titulo={`Planilla · ${vistaPlanilla.totalFilas} filas`} vista={vistaPlanilla} mapeo={mapeoPlanilla} moneda={moneda} origen="planilla" alCambiar={(campo, valor) => setMapeoPlanilla((actual) => ({ ...actual, [campo]: valor || undefined }))} />
          </div>
        </>
      ) : null}

      {progreso ? (
        <div className="progress-wrap" aria-live="polite">
          <div className="progress-meta"><span>{progreso.mensaje}</span><span>{progreso.porcentaje}%</span></div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso.porcentaje}><div style={{ width: `${progreso.porcentaje}%` }} /></div>
        </div>
      ) : null}

      <div className="panel-actions">
        <button className="button button-secondary" type="button" disabled={paso === 1 || cargando} onClick={() => setPaso((actual) => Math.max(1, actual - 1))}>Atrás</button>
        {paso === 1 ? <button className="button button-primary" type="button" disabled={!puedeAvanzarPaso1 || cargando} onClick={() => setPaso(2)}>Continuar</button> : null}
        {paso === 2 ? <button className="button button-primary" type="button" disabled={!planilla || cargando} onClick={() => void prepararVista()}>{cargando ? 'Leyendo…' : 'Revisar columnas'}</button> : null}
        {paso === 3 ? <button className="button button-primary" type="button" disabled={!puedeConciliar || cargando || Boolean(progreso)} onClick={() => void confirmar()}>{progreso ? 'Procesando…' : 'Conciliar'}</button> : null}
      </div>
    </div>
  );
}
