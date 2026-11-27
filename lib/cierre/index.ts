import type { Movimiento } from '@/lib/dominio';

export interface CorteSaldo {
  fila: number;
  esperadoCentavos: number;
  informadoCentavos: number;
  diferenciaCentavos: number;
}

export interface ControlCierre {
  verificado: boolean;
  cierra: boolean | null;
  saldoInicialCentavos?: number;
  saldoFinalCentavos?: number;
  sumaMovimientosCentavos: number;
  diferenciaCentavos?: number;
  cortes: CorteSaldo[];
  mensaje: string;
}

export function controlarCierre(
  movimientos: Movimiento[],
  saldosManuales?: { inicialCentavos: number; finalCentavos: number },
): ControlCierre {
  const sumaMovimientosCentavos = movimientos.reduce(
    (total, movimiento) => total + movimiento.centavos,
    0,
  );
  if (movimientos.length === 0) {
    return {
      verificado: false,
      cierra: null,
      sumaMovimientosCentavos,
      cortes: [],
      mensaje: 'Cierre no verificado: el extracto no tiene movimientos',
    };
  }

  const conSaldo = movimientos.every((movimiento) => movimiento.saldoCentavos !== undefined);
  if (!conSaldo && !saldosManuales) {
    return {
      verificado: false,
      cierra: null,
      sumaMovimientosCentavos,
      cortes: [],
      mensaje: 'Cierre no verificado',
    };
  }

  if (conSaldo) {
    const primero = movimientos[0];
    const ultimo = movimientos[movimientos.length - 1];
    const saldoInicialCentavos = primero.saldoCentavos! - primero.centavos;
    const saldoFinalCentavos = ultimo.saldoCentavos!;
    const cortes: CorteSaldo[] = [];
    let saldoEsperado = saldoInicialCentavos;
    for (const movimiento of movimientos) {
      saldoEsperado += movimiento.centavos;
      const informado = movimiento.saldoCentavos!;
      if (informado !== saldoEsperado) {
        cortes.push({
          fila: movimiento.fila,
          esperadoCentavos: saldoEsperado,
          informadoCentavos: informado,
          diferenciaCentavos: informado - saldoEsperado,
        });
      }
      saldoEsperado = informado;
    }
    const calculado = saldoInicialCentavos + sumaMovimientosCentavos;
    const diferenciaCentavos = saldoFinalCentavos - calculado;
    const cierra = diferenciaCentavos === 0 && cortes.length === 0;
    return {
      verificado: true,
      cierra,
      saldoInicialCentavos,
      saldoFinalCentavos,
      sumaMovimientosCentavos,
      diferenciaCentavos,
      cortes,
      mensaje: cierra ? 'El saldo del extracto cierra' : 'El saldo del extracto no cierra',
    };
  }

  const saldoInicialCentavos = saldosManuales!.inicialCentavos;
  const saldoFinalCentavos = saldosManuales!.finalCentavos;
  const diferenciaCentavos = saldoFinalCentavos - (saldoInicialCentavos + sumaMovimientosCentavos);
  return {
    verificado: true,
    cierra: diferenciaCentavos === 0,
    saldoInicialCentavos,
    saldoFinalCentavos,
    sumaMovimientosCentavos,
    diferenciaCentavos,
    cortes: [],
    mensaje:
      diferenciaCentavos === 0 ? 'El saldo informado cierra' : 'El saldo informado no cierra',
  };
}
