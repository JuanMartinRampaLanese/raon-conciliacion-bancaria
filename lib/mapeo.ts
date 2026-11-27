import type { MapeoColumnas } from '@/lib/dominio';

export const CAMPOS_MAPEO: Array<{ clave: keyof MapeoColumnas; etiqueta: string }> = [
  { clave: 'fecha', etiqueta: 'Fecha' },
  { clave: 'descripcion', etiqueta: 'Descripción' },
  { clave: 'importe', etiqueta: 'Importe con signo' },
  { clave: 'debito', etiqueta: 'Débito' },
  { clave: 'credito', etiqueta: 'Crédito' },
  { clave: 'saldo', etiqueta: 'Saldo' },
  { clave: 'cliente', etiqueta: 'Cliente' },
  { clave: 'referencia', etiqueta: 'Referencia' },
  { clave: 'moneda', etiqueta: 'Moneda' },
  { clave: 'tipo', etiqueta: 'Tipo' },
];
