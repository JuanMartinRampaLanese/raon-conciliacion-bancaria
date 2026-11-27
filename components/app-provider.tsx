'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { MapeoColumnas, Moneda, Regla } from '@/lib/dominio';
import { crearAlmacenLocal, type Almacen } from '@/lib/almacen';
import { aceptarDudoso, calcularResumen } from '@/lib/motor';
import { calcularSaldosPorCliente } from '@/lib/saldos';
import { nombreArchivoExcel } from '@/lib/excel';
import { pedirConciliacion, pedirExcel } from '@/lib/worker/cliente';
import type { ArchivoBytes, DatosConciliacion } from '@/lib/worker/protocolo';

interface EntradaConciliacion {
  banco: ArchivoBytes;
  planilla: ArchivoBytes;
  mapeoBanco: MapeoColumnas;
  mapeoPlanilla: MapeoColumnas;
  nombreBanco: string;
  moneda: Moneda;
  reglas: Regla[];
}

interface Progreso {
  porcentaje: number;
  mensaje: string;
}

interface ContextoAplicacion {
  datos: DatosConciliacion | null;
  progreso: Progreso | null;
  almacen: Almacen;
  conciliar(entrada: EntradaConciliacion): Promise<DatosConciliacion>;
  aceptar(resultadoId: string, indiceCandidato: number): Regla | undefined;
  rechazar(resultadoId: string): void;
  descargar(): Promise<void>;
}

const Contexto = createContext<ContextoAplicacion | null>(null);

export function ProveedorAplicacion({ children }: { children: ReactNode }) {
  const almacen = useMemo(() => crearAlmacenLocal(), []);
  const [datos, setDatos] = useState<DatosConciliacion | null>(null);
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  const conciliar = useCallback(async (entrada: EntradaConciliacion) => {
    setProgreso({ porcentaje: 2, mensaje: 'Preparando archivos' });
    try {
      const resultado = await pedirConciliacion(
        {
          tipo: 'conciliar',
          ...entrada,
          zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        (porcentaje, mensaje) => setProgreso({ porcentaje, mensaje }),
      );
      setDatos(resultado);
      await almacen.guardarResumen(resultado.resumen);
      return resultado;
    } finally {
      setProgreso(null);
    }
  }, [almacen]);

  const aceptar = useCallback(
    (resultadoId: string, indiceCandidato: number) => {
      if (!datos) return undefined;
      const aceptado = aceptarDudoso({
        resultados: datos.resultados,
        resultadoId,
        indiceCandidato,
        banco: datos.movimientosBanco,
        planilla: datos.movimientosPlanilla,
      });
      const fondos = calcularSaldosPorCliente(
        datos.movimientosPlanilla,
        aceptado.resultados,
        datos.cierre.saldoFinalCentavos,
      );
      setDatos({
        ...datos,
        resultados: aceptado.resultados,
        resumen: aceptado.resumen,
        fondos,
        excel: new Uint8Array(),
      });
      return aceptado.reglaSugerida;
    },
    [datos],
  );

  const rechazar = useCallback(
    (resultadoId: string) => {
      if (!datos) return;
      const resultados = datos.resultados.map((resultado) =>
        resultado.id === resultadoId && resultado.estado === 'dudoso'
          ? {
              ...resultado,
              estado: 'solo_banco' as const,
              candidatos: undefined,
              nota: 'Descartado durante la revisión manual',
            }
          : resultado,
      );
      const resumen = calcularResumen(resultados, datos.movimientosBanco, datos.movimientosPlanilla);
      const fondos = calcularSaldosPorCliente(
        datos.movimientosPlanilla,
        resultados,
        datos.cierre.saldoFinalCentavos,
      );
      setDatos({ ...datos, resultados, resumen, fondos, excel: new Uint8Array() });
    },
    [datos],
  );

  const descargar = useCallback(async () => {
    if (!datos) throw new Error('Todavía no hay una conciliación para descargar');
    const excel =
      datos.excel.byteLength > 0
        ? datos.excel
        : await pedirExcel({
            tipo: 'exportar',
            datos: {
              nombreBanco: datos.nombreBanco,
              moneda: datos.moneda,
              periodo: datos.periodo,
              movimientosBanco: datos.movimientosBanco,
              movimientosPlanilla: datos.movimientosPlanilla,
              resultados: datos.resultados,
              resumen: datos.resumen,
              cierre: datos.cierre,
              fondos: datos.fondos,
              reglas: datos.reglas,
            },
            zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
    const blob = new Blob([excel.slice().buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivoExcel(datos.nombreBanco, datos.moneda, datos.periodo);
    enlace.click();
    URL.revokeObjectURL(url);
  }, [datos]);

  const valor = useMemo(
    () => ({ datos, progreso, almacen, conciliar, aceptar, rechazar, descargar }),
    [datos, progreso, almacen, conciliar, aceptar, rechazar, descargar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAplicacion(): ContextoAplicacion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAplicacion debe estar dentro de ProveedorAplicacion');
  return contexto;
}
