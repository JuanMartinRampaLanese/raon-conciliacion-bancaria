import { expect, it } from 'vitest';
import type { Movimiento, Resultado } from '@/lib/dominio';
import { controlarCierre } from '@/lib/cierre';
import { calcularSaldosPorCliente } from '@/lib/saldos';

function mov(id: string, centavos: number, saldoCentavos?: number): Movimiento {
  return {
    id,
    origen: id.startsWith('B') ? 'banco' : 'planilla',
    fecha: '2026-10-01',
    descripcion: id,
    texto: id,
    centavos,
    moneda: 'UYU',
    cliente: id.startsWith('P') ? 'Cliente' : undefined,
    tipo: id.startsWith('P') ? 'tercero' : undefined,
    saldoCentavos,
    fila: Number(id.slice(2)),
  };
}

it('controla saldo global y fila por fila', () => {
  expect(controlarCierre([mov('B-0001', 100, 1_100), mov('B-0002', -50, 1_050)]).cierra).toBe(true);
  const roto = controlarCierre([mov('B-0001', 100, 1_100), mov('B-0002', -50, 1_060)]);
  expect(roto.cierra).toBe(false);
  expect(roto.cortes[0].fila).toBe(2);
  expect(roto.cortes[0].diferenciaCentavos).toBe(10);
  expect(controlarCierre([mov('B-0001', 100)]).verificado).toBe(false);
});

it('calcula fondos de terceros y alerta por faltante', () => {
  const planilla = [mov('P-0001', 10_000), mov('P-0002', -3_000)];
  const resultados: Resultado[] = [
    {
      id: 'R-1',
      estado: 'conciliado',
      paso: 'exacto',
      banco: ['B-1'],
      planilla: ['P-0001'],
      diferenciaCentavos: 0,
      puntaje: 1,
      nota: '',
    },
  ];
  const saldos = calcularSaldosPorCliente(planilla, resultados, 5_000);
  expect(saldos.clientes[0]).toMatchObject({
    cobradoCentavos: 10_000,
    pagadoCentavos: 3_000,
    saldoCentavos: 7_000,
    conciliadoCentavos: 10_000,
    pendienteCentavos: -3_000,
  });
  expect(saldos.alerta).toBe(true);
  expect(saldos.mensaje).toBe('En el banco hay menos plata que la que se le debe a terceros');
});
