import type { Movimiento } from '@/lib/dominio';

export function formatearFechaPantalla(fecha: string | undefined): string {
  if (!fecha) return '—';
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return coincidencia
    ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}`
    : fecha;
}

export function clientesUnicos(movimientos: Movimiento[]): string {
  const clientes = [
    ...new Set(
      movimientos
        .map((movimiento) => movimiento.cliente?.trim())
        .filter((cliente): cliente is string => Boolean(cliente)),
    ),
  ];
  return clientes.join(', ') || '—';
}
