import { describe, expect, it } from 'vitest';
import type { Movimiento, Regla } from '@/lib/dominio';
import {
  aceptarDudoso,
  calcularResumen,
  conciliar,
  puntuar,
  REGLAS_GASTOS_PREDETERMINADAS,
  similitudTextos,
} from '@/lib/motor';
import { normalizarTexto } from '@/lib/normalizar';

function m(
  id: string,
  origen: 'banco' | 'planilla',
  fecha: string,
  centavos: number,
  descripcion: string,
  cliente?: string,
): Movimiento {
  return {
    id,
    origen,
    fecha,
    descripcion,
    texto: normalizarTexto(descripcion),
    centavos,
    moneda: 'UYU',
    cliente,
    tipo: origen === 'planilla' ? 'tercero' : undefined,
    fila: Number(id.slice(2)),
  };
}

function correr(banco: Movimiento[], planilla: Movimiento[], reglas: Regla[] = []) {
  return conciliar({ banco, planilla, reglas });
}

describe('cascada del motor', () => {
  it('cruza exacto y desempata por nombre', () => {
    const banco = [
      m('B-0001', 'banco', '2026-10-01', 100_000, 'TRF ANA PEREZ'),
      m('B-0002', 'banco', '2026-10-01', 100_000, 'TRF BETO SOSA'),
    ];
    const planilla = [
      m('P-0001', 'planilla', '2026-10-01', 100_000, 'Alquiler', 'Ana Perez'),
      m('P-0002', 'planilla', '2026-10-01', 100_000, 'Alquiler', 'Beto Sosa'),
    ];
    const resultado = correr(banco, planilla).resultados.filter((r) => r.estado === 'conciliado');
    expect(resultado.map((r) => r.planilla)).toEqual([['P-0001'], ['P-0002']]);
  });

  it('aplica tolerancia con posible comisión', () => {
    const resultado = correr(
      [m('B-0001', 'banco', '2026-10-01', 2_485_000, 'Cobro Cometa')],
      [m('P-0001', 'planilla', '2026-10-01', 2_500_000, 'Alquiler', 'Cometa')],
    ).resultados[0];
    expect(resultado.estado).toBe('conciliado_con_diferencia');
    expect(resultado.paso).toBe('tolerancia');
  });

  it('resuelve uno a muchos', () => {
    const resultado = correr(
      [m('B-0001', 'banco', '2026-10-02', 300_000, 'Depósito Acme')],
      [
        m('P-0001', 'planilla', '2026-10-01', 100_000, 'Factura 1', 'Acme'),
        m('P-0002', 'planilla', '2026-10-02', 200_000, 'Factura 2', 'Acme'),
      ],
    ).resultados[0];
    expect(resultado.paso).toBe('uno_a_muchos');
  });

  it('resuelve muchos a uno', () => {
    const resultado = correr(
      [
        m('B-0001', 'banco', '2026-10-01', 100_000, 'TRF Acme 1'),
        m('B-0002', 'banco', '2026-10-02', 200_000, 'TRF Acme 2'),
      ],
      [m('P-0001', 'planilla', '2026-10-02', 300_000, 'Alquiler', 'Acme')],
    ).resultados.find((r) => r.paso === 'muchos_a_uno');
    expect(resultado?.banco).toEqual(['B-0001', 'B-0002']);
  });

  it('aplica gasto luego de los cruces y deja restos', () => {
    const resultado = correr(
      [
        m('B-0001', 'banco', '2026-10-01', -10_000, 'COMISION MENSUAL'),
        m('B-0002', 'banco', '2026-10-01', 90_000, 'INGRESO DESCONOCIDO'),
      ],
      [],
      REGLAS_GASTOS_PREDETERMINADAS,
    );
    expect(resultado.resultados.map((r) => r.estado)).toEqual(['gasto_bancario', 'solo_banco']);
  });

  it('aplica la regla de gasto más específica', () => {
    const resultado = correr(
      [m('B-0001', 'banco', '2026-10-01', -2_200, 'IVA COMISION')],
      [],
      REGLAS_GASTOS_PREDETERMINADAS,
    ).resultados[0];
    expect(resultado.nota).toContain('IVA COMISION');
  });

  it('crea dudoso por pago parcial usando similitud y permite aceptarlo', () => {
    const banco = [
      m('B-0001', 'banco', '2026-10-01', 100_000, 'TRF Hotel'),
      m('B-0002', 'banco', '2026-10-02', 100_000, 'TRF Hotel'),
    ];
    const planilla = [m('P-0001', 'planilla', '2026-10-01', 250_000, 'Alquiler', 'Hotel')];
    const inicial = correr(banco, planilla);
    const dudoso = inicial.resultados.find((r) => r.estado === 'dudoso')!;
    expect(dudoso.candidatos?.[0].motivo).toContain('Posible pago parcial');
    const manual = aceptarDudoso({
      resultados: inicial.resultados,
      resultadoId: dudoso.id,
      indiceCandidato: 0,
      banco,
      planilla,
    });
    expect(manual.resultados.find((r) => r.id === dudoso.id)?.paso).toBe('manual');
    expect(manual.reglaSugerida?.cliente).toBe('Hotel');
    expect(manual.resumen.soloPlanilla).toBe(inicial.resumen.soloPlanilla - 1);
    expect(
      manual.resultados.filter(
        (resultado) =>
          resultado.planilla.includes('P-0001') ||
          resultado.candidatos?.some((candidato) => candidato.planilla.includes('P-0001')),
      ),
    ).toHaveLength(1);
    expect(manual.resultados.find((resultado) => resultado.banco.includes('B-0002'))?.estado).toBe(
      'solo_banco',
    );
  });

  it('reconoce el nombre en cualquier orden y es puro/determinístico', () => {
    const banco = [m('B-0001', 'banco', '2026-10-01', 100, 'TRF PEREZ JUAN')];
    const planilla = [m('P-0001', 'planilla', '2026-10-01', 100, 'Alquiler', 'Juan Perez')];
    expect(similitudTextos(banco[0], planilla[0])).toBeGreaterThanOrEqual(0.9);
    expect(correr(banco, planilla)).toEqual(correr(banco, planilla));
    expect(banco[0].cliente).toBeUndefined();
  });

  it('redondea todos los puntajes a dos decimales', () => {
    const banco = m('B-0001', 'banco', '2026-10-01', 100_000, 'TRF Hotel');
    const planilla = m('P-0001', 'planilla', '2026-10-01', 200_000, 'Alquiler', 'Hotel');
    expect(puntuar(banco, planilla)).toBe(0.47);
    const candidato = correr([banco], [planilla]).resultados[0].candidatos?.[0];
    expect(candidato?.puntaje).toBe(0.47);
  });

  it('suma los montos de planilla en el total solo_planilla', () => {
    const planilla = [m('P-0001', 'planilla', '2026-10-01', 123_456, 'Pendiente', 'Acme')];
    const resumen = calcularResumen(
      [
        {
          id: 'R-0001',
          estado: 'solo_planilla',
          banco: [],
          planilla: ['P-0001'],
          diferenciaCentavos: -123_456,
          puntaje: 0,
          nota: '',
        },
      ],
      [],
      planilla,
    );
    expect(resumen.totalesPorEstado.solo_planilla?.centavos).toBe(123_456);
  });
});

it('procesa 2.000 x 2.000 exactos en menos de 2 segundos', () => {
  const banco: Movimiento[] = [];
  const planilla: Movimiento[] = [];
  for (let indice = 1; indice <= 2_000; indice += 1) {
    banco.push(
      m(
        'B-' + String(indice).padStart(4, '0'),
        'banco',
        '2026-10-01',
        indice * 100,
        'Movimiento ' + indice,
      ),
    );
    planilla.push(
      m(
        'P-' + String(indice).padStart(4, '0'),
        'planilla',
        '2026-10-01',
        indice * 100,
        'Movimiento ' + indice,
      ),
    );
  }
  const inicio = performance.now();
  const resultado = correr(banco, planilla);
  expect(resultado.resumen.conciliados).toBe(2_000);
  expect(performance.now() - inicio).toBeLessThan(2_000);
});
