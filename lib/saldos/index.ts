import type { Movimiento, Resultado } from '@/lib/dominio';

export interface SaldoCliente {
  cliente: string;
  cobradoCentavos: number;
  pagadoCentavos: number;
  saldoCentavos: number;
  conciliadoCentavos: number;
  pendienteCentavos: number;
}

export interface ResumenFondosTerceros {
  clientes: SaldoCliente[];
  totalTercerosCentavos: number;
  saldoBancoCentavos?: number;
  diferenciaCentavos?: number;
  alerta: boolean;
  mensaje: string;
}

export function calcularSaldosPorCliente(
  planilla: Movimiento[],
  resultados: Resultado[],
  saldoBancoCentavos?: number,
): ResumenFondosTerceros {
  const idsConciliados = new Set(
    resultados
      .filter((resultado) => ['conciliado', 'conciliado_con_diferencia'].includes(resultado.estado))
      .flatMap((resultado) => resultado.planilla),
  );
  const acumulados = new Map<string, SaldoCliente>();
  for (const movimiento of planilla) {
    if (movimiento.tipo !== 'tercero' || !movimiento.cliente) continue;
    const saldo = acumulados.get(movimiento.cliente) ?? {
      cliente: movimiento.cliente,
      cobradoCentavos: 0,
      pagadoCentavos: 0,
      saldoCentavos: 0,
      conciliadoCentavos: 0,
      pendienteCentavos: 0,
    };
    if (movimiento.centavos >= 0) saldo.cobradoCentavos += movimiento.centavos;
    else saldo.pagadoCentavos += Math.abs(movimiento.centavos);
    saldo.saldoCentavos += movimiento.centavos;
    if (idsConciliados.has(movimiento.id)) saldo.conciliadoCentavos += movimiento.centavos;
    else saldo.pendienteCentavos += movimiento.centavos;
    acumulados.set(movimiento.cliente, saldo);
  }
  const clientes = [...acumulados.values()].sort((a, b) =>
    a.cliente < b.cliente ? -1 : a.cliente > b.cliente ? 1 : 0,
  );
  const totalTercerosCentavos = clientes.reduce(
    (total, cliente) => total + cliente.saldoCentavos,
    0,
  );
  const diferenciaCentavos =
    saldoBancoCentavos === undefined ? undefined : saldoBancoCentavos - totalTercerosCentavos;
  const alerta = diferenciaCentavos !== undefined && diferenciaCentavos < 0;
  return {
    clientes,
    totalTercerosCentavos,
    saldoBancoCentavos,
    diferenciaCentavos,
    alerta,
    mensaje:
      saldoBancoCentavos === undefined
        ? 'No se informó el saldo final del banco'
        : alerta
          ? 'En el banco hay menos plata que la que se le debe a terceros'
          : 'El saldo del banco cubre los fondos de terceros',
  };
}
