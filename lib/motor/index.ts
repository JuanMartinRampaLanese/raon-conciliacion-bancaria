import type {
  Candidato,
  ConfigMotor,
  Estado,
  Movimiento,
  Regla,
  Resultado,
  Resumen,
} from '@/lib/dominio';
import { diferenciaDias, normalizarTexto } from '@/lib/normalizar';

export const CONFIG_PREDETERMINADA: ConfigMotor = {
  ventanaDias: 3,
  ventanaAgrupadoDias: 7,
  toleranciaPct: 0.01,
  toleranciaMaxCentavos: 50_000,
  similitudMin: 0.6,
  maxAgrupados: 3,
  puntajeMinDudoso: 0.4,
};

export const REGLAS_GASTOS_PREDETERMINADAS: Regla[] = [
  'COMISION',
  'IVA COMISION',
  'GASTOS BANCARIOS',
  'MANTENIMIENTO DE CUENTA',
  'IMPUESTO',
].map((patron, indice) => ({
  id: `RG-${String(indice + 1).padStart(2, '0')}`,
  patron,
  accion: 'gasto_bancario',
  origen: 'por_defecto',
}));

const VACIAS = new Set([
  'TRF',
  'TRANSF',
  'TRANSFERENCIA',
  'RECIBIDA',
  'ENVIADA',
  'DEP',
  'DEPOSITO',
  'PAGO',
  'COBRO',
  'DE',
  'DEL',
  'LA',
  'EL',
  'LOS',
  'LAS',
  'Y',
  'SA',
  'SRL',
  'SAS',
  'LTDA',
]);

function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function ordenarMovimientos(a: Movimiento, b: Movimiento): number {
  return (
    compararTexto(a.fecha, b.fecha) ||
    Math.abs(b.centavos) - Math.abs(a.centavos) ||
    compararTexto(a.id, b.id)
  );
}

function palabrasUtiles(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter((palabra) => palabra && !VACIAS.has(palabra));
}

function trigramas(texto: string): Set<string> {
  const limpio = palabrasUtiles(texto).join(' ');
  if (limpio.length < 3) return new Set(limpio ? [limpio] : []);
  const resultado = new Set<string>();
  for (let indice = 0; indice <= limpio.length - 3; indice += 1) {
    resultado.add(limpio.slice(indice, indice + 3));
  }
  return resultado;
}

export function similitudTextos(banco: Movimiento, planilla: Movimiento): number {
  if (banco.cliente && planilla.cliente) {
    if (normalizarTexto(banco.cliente) === normalizarTexto(planilla.cliente)) return 1;
  }
  const palabrasCliente = palabrasUtiles(planilla.cliente ?? '').filter(
    (palabra) => palabra.length >= 3,
  );
  const palabrasBanco = new Set(palabrasUtiles(banco.texto));
  const contieneNombre =
    palabrasCliente.length > 0 && palabrasCliente.every((palabra) => palabrasBanco.has(palabra));
  const a = trigramas(banco.texto);
  const b = trigramas(`${planilla.cliente ?? ''} ${planilla.texto}`);
  if (a.size === 0 || b.size === 0) return contieneNombre ? 0.9 : 0;
  let interseccion = 0;
  for (const valor of a) if (b.has(valor)) interseccion += 1;
  const dice = (2 * interseccion) / (a.size + b.size);
  return contieneNombre ? Math.max(0.9, dice) : dice;
}

export function puntuar(banco: Movimiento, planilla: Movimiento): number {
  const diferencia = Math.abs(banco.centavos - planilla.centavos);
  const montoScore =
    diferencia === 0
      ? 1
      : Math.max(0, 1 - diferencia / Math.max(1, 0.05 * Math.abs(planilla.centavos)));
  const fechaScore = Math.max(0, 1 - diferenciaDias(banco.fecha, planilla.fecha) / 10);
  return 0.5 * montoScore + 0.3 * similitudTextos(banco, planilla) + 0.2 * fechaScore;
}

function mismoSigno(a: number, b: number): boolean {
  return (a >= 0 && b >= 0) || (a < 0 && b < 0);
}

function toleranciaPermitida(planilla: number, config: ConfigMotor): number {
  return Math.min(
    Math.round(config.toleranciaPct * Math.abs(planilla)),
    config.toleranciaMaxCentavos,
  );
}

function formatoMonto(centavos: number): string {
  return new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(centavos) / 100);
}

function aplicarReglasCliente(banco: Movimiento[], reglas: Regla[]): Movimiento[] {
  const asignaciones = reglas
    .filter((regla) => regla.accion === 'asignar_cliente' && regla.cliente)
    .map((regla) => ({ ...regla, patron: normalizarTexto(regla.patron) }));
  return banco.map((movimiento) => {
    const regla = asignaciones.find((candidata) => movimiento.texto.includes(candidata.patron));
    return regla ? { ...movimiento, cliente: regla.cliente } : { ...movimiento };
  });
}

function porMonto(movimientos: Movimiento[]): Map<number, Movimiento[]> {
  const indice = new Map<number, Movimiento[]>();
  for (const movimiento of movimientos) {
    const lista = indice.get(movimiento.centavos) ?? [];
    lista.push(movimiento);
    indice.set(movimiento.centavos, lista);
  }
  return indice;
}

function resultadoCruce(
  banco: Movimiento[],
  planilla: Movimiento[],
  paso: Resultado['paso'],
): Resultado {
  const montoBanco = banco.reduce((total, movimiento) => total + movimiento.centavos, 0);
  const montoPlanilla = planilla.reduce((total, movimiento) => total + movimiento.centavos, 0);
  const diferencia = montoBanco - montoPlanilla;
  const estado: Estado = diferencia === 0 ? 'conciliado' : 'conciliado_con_diferencia';
  const puntajes = banco.flatMap((b) => planilla.map((p) => puntuar(b, p)));
  return {
    id: '',
    estado,
    paso,
    banco: banco.map((movimiento) => movimiento.id),
    planilla: planilla.map((movimiento) => movimiento.id),
    diferenciaCentavos: diferencia,
    puntaje: puntajes.length ? Math.max(...puntajes) : 1,
    nota:
      estado === 'conciliado_con_diferencia'
        ? `Diferencia de $ ${formatoMonto(diferencia)} (posible comisión o retención)`
        : paso === 'uno_a_muchos' || paso === 'muchos_a_uno'
          ? 'Movimientos agrupados automáticamente'
          : 'Monto y fecha conciliados',
  };
}

function resolverEmpateExacto(
  banco: Movimiento,
  candidatos: Movimiento[],
  config: ConfigMotor,
): Movimiento | undefined {
  if (candidatos.length === 1) return candidatos[0];
  if (banco.cliente) {
    const porCliente = candidatos.filter(
      (candidato) =>
        candidato.cliente && normalizarTexto(candidato.cliente) === normalizarTexto(banco.cliente),
    );
    if (porCliente.length === 1) return porCliente[0];
  }
  const porSimilitud = candidatos
    .map((candidato) => ({ candidato, similitud: similitudTextos(banco, candidato) }))
    .filter((item) => item.similitud >= config.similitudMin)
    .sort((a, b) => b.similitud - a.similitud || a.candidato.fila - b.candidato.fila);
  if (
    porSimilitud.length === 1 ||
    (porSimilitud[0] && porSimilitud[0].similitud > porSimilitud[1]?.similitud)
  ) {
    return porSimilitud[0]?.candidato;
  }
  const primera = candidatos[0];
  if (
    primera &&
    candidatos.every(
      (candidato) =>
        candidato.fecha === primera.fecha &&
        normalizarTexto(candidato.cliente) === normalizarTexto(primera.cliente),
    )
  ) {
    return [...candidatos].sort((a, b) => a.fila - b.fila || compararTexto(a.id, b.id))[0];
  }
  return undefined;
}

function combinaciones<T>(valores: T[], minimo: number, maximo: number): T[][] {
  const resultado: T[][] = [];
  const visitar = (inicio: number, actual: T[]): void => {
    if (actual.length >= minimo) resultado.push([...actual]);
    if (actual.length === maximo) return;
    for (let indice = inicio; indice < valores.length; indice += 1) {
      actual.push(valores[indice]);
      visitar(indice + 1, actual);
      actual.pop();
    }
  };
  visitar(0, []);
  return resultado;
}

function clienteCompatible(banco: Movimiento, planilla: Movimiento, config: ConfigMotor): boolean {
  if (banco.cliente && planilla.cliente) {
    return normalizarTexto(banco.cliente) === normalizarTexto(planilla.cliente);
  }
  return similitudTextos(banco, planilla) >= config.similitudMin;
}

export function calcularResumen(
  resultados: Resultado[],
  banco: Movimiento[],
  planilla: Movimiento[],
): Resumen {
  const conciliadosEstados = new Set<Estado>(['conciliado', 'conciliado_con_diferencia']);
  const totalesPorEstado: Resumen['totalesPorEstado'] = {};
  for (const resultado of resultados) {
    const centavos = resultado.banco
      .map((id) => banco.find((movimiento) => movimiento.id === id)?.centavos ?? 0)
      .reduce((total, monto) => total + monto, 0);
    const actual = totalesPorEstado[resultado.estado] ?? { cantidad: 0, centavos: 0 };
    totalesPorEstado[resultado.estado] = {
      cantidad: actual.cantidad + 1,
      centavos: actual.centavos + centavos,
    };
  }
  const idsBancoConciliados = new Set(
    resultados.filter((r) => conciliadosEstados.has(r.estado)).flatMap((r) => r.banco),
  );
  const montoTotal = banco.reduce((total, movimiento) => total + Math.abs(movimiento.centavos), 0);
  const montoConciliado = banco
    .filter((movimiento) => idsBancoConciliados.has(movimiento.id))
    .reduce((total, movimiento) => total + Math.abs(movimiento.centavos), 0);
  const contar = (estado: Estado): number => resultados.filter((r) => r.estado === estado).length;
  return {
    cantidadBanco: banco.length,
    cantidadPlanilla: planilla.length,
    conciliados: resultados.filter((r) => conciliadosEstados.has(r.estado)).length,
    dudosos: contar('dudoso'),
    soloBanco: contar('solo_banco'),
    soloPlanilla: contar('solo_planilla'),
    gastosBancarios: contar('gasto_bancario'),
    porcentajeConciliadoCantidad: banco.length ? idsBancoConciliados.size / banco.length : 0,
    porcentajeConciliadoMonto: montoTotal ? montoConciliado / montoTotal : 0,
    totalesPorEstado,
  };
}

export function conciliar(entrada: {
  banco: Movimiento[];
  planilla: Movimiento[];
  reglas: Regla[];
  config?: Partial<ConfigMotor>;
}): { resultados: Resultado[]; resumen: Resumen } {
  const config = { ...CONFIG_PREDETERMINADA, ...entrada.config };
  const banco = aplicarReglasCliente(entrada.banco, entrada.reglas).sort(ordenarMovimientos);
  const planilla = entrada.planilla
    .map((movimiento) => ({ ...movimiento }))
    .sort(ordenarMovimientos);
  const usadosBanco = new Set<string>();
  const usadosPlanilla = new Set<string>();
  const resultados: Resultado[] = [];
  const indiceMonto = porMonto(planilla);

  // 1. Exacto. El índice por monto mantiene lineal el caso habitual y la prueba de rendimiento.
  const candidatosExactos = new Map<string, Movimiento[]>();
  const bancosPorPlanilla = new Map<string, string[]>();
  for (const movimientoBanco of banco) {
    const candidatos = (indiceMonto.get(movimientoBanco.centavos) ?? []).filter(
      (movimientoPlanilla) =>
        diferenciaDias(movimientoBanco.fecha, movimientoPlanilla.fecha) <= config.ventanaDias,
    );
    candidatosExactos.set(movimientoBanco.id, candidatos);
    for (const candidato of candidatos) {
      const lista = bancosPorPlanilla.get(candidato.id) ?? [];
      lista.push(movimientoBanco.id);
      bancosPorPlanilla.set(candidato.id, lista);
    }
  }
  for (const movimientoBanco of banco) {
    if (usadosBanco.has(movimientoBanco.id)) continue;
    const candidatos = (candidatosExactos.get(movimientoBanco.id) ?? []).filter(
      (candidato) => !usadosPlanilla.has(candidato.id),
    );
    const elegido = resolverEmpateExacto(movimientoBanco, candidatos, config);
    if (!elegido) continue;
    const inversosDisponibles = (bancosPorPlanilla.get(elegido.id) ?? []).filter(
      (id) => !usadosBanco.has(id),
    );
    const indistinguibles = candidatos.every(
      (candidato) =>
        candidato.fecha === elegido.fecha &&
        normalizarTexto(candidato.cliente) === normalizarTexto(elegido.cliente),
    );
    if (inversosDisponibles.length !== 1 && !indistinguibles && candidatos.length === 1) continue;
    usadosBanco.add(movimientoBanco.id);
    usadosPlanilla.add(elegido.id);
    resultados.push(resultadoCruce([movimientoBanco], [elegido], 'exacto'));
  }

  // 2. Tolerancia. Se limita por fecha y similitud antes de elegir de forma bidireccional.
  const pendientesBanco = banco.filter((movimiento) => !usadosBanco.has(movimiento.id));
  const pendientesPlanilla = planilla.filter((movimiento) => !usadosPlanilla.has(movimiento.id));
  const tolerantes = new Map<string, Movimiento[]>();
  const inversosTolerantes = new Map<string, string[]>();
  for (const movimientoBanco of pendientesBanco) {
    const candidatos = pendientesPlanilla.filter((movimientoPlanilla) => {
      const diferencia = Math.abs(movimientoBanco.centavos - movimientoPlanilla.centavos);
      return (
        mismoSigno(movimientoBanco.centavos, movimientoPlanilla.centavos) &&
        diferencia > 0 &&
        diferencia <= toleranciaPermitida(movimientoPlanilla.centavos, config) &&
        diferenciaDias(movimientoBanco.fecha, movimientoPlanilla.fecha) <= config.ventanaDias &&
        clienteCompatible(movimientoBanco, movimientoPlanilla, config)
      );
    });
    tolerantes.set(movimientoBanco.id, candidatos);
    for (const candidato of candidatos) {
      const lista = inversosTolerantes.get(candidato.id) ?? [];
      lista.push(movimientoBanco.id);
      inversosTolerantes.set(candidato.id, lista);
    }
  }
  for (const movimientoBanco of pendientesBanco) {
    if (usadosBanco.has(movimientoBanco.id)) continue;
    const candidatos = (tolerantes.get(movimientoBanco.id) ?? []).filter(
      (candidato) => !usadosPlanilla.has(candidato.id),
    );
    if (candidatos.length !== 1) continue;
    const elegido = candidatos[0];
    if (
      (inversosTolerantes.get(elegido.id) ?? []).filter((id) => !usadosBanco.has(id)).length !== 1
    )
      continue;
    usadosBanco.add(movimientoBanco.id);
    usadosPlanilla.add(elegido.id);
    resultados.push(resultadoCruce([movimientoBanco], [elegido], 'tolerancia'));
  }

  // 3. Uno a muchos. Como máximo se combinan 12 candidatos del mismo cliente.
  for (const movimientoBanco of banco) {
    if (usadosBanco.has(movimientoBanco.id)) continue;
    const posibles = planilla
      .filter(
        (movimientoPlanilla) =>
          !usadosPlanilla.has(movimientoPlanilla.id) &&
          mismoSigno(movimientoBanco.centavos, movimientoPlanilla.centavos) &&
          diferenciaDias(movimientoBanco.fecha, movimientoPlanilla.fecha) <=
            config.ventanaAgrupadoDias &&
          clienteCompatible(movimientoBanco, movimientoPlanilla, config),
      )
      .slice(0, 12);
    const validas = combinaciones(posibles, 2, config.maxAgrupados).filter((grupo) => {
      const clientes = new Set(grupo.map((m) => normalizarTexto(m.cliente)));
      const suma = grupo.reduce((total, m) => total + m.centavos, 0);
      return (
        clientes.size === 1 &&
        Math.abs(movimientoBanco.centavos - suma) <= toleranciaPermitida(suma, config)
      );
    });
    if (validas.length !== 1) continue;
    const grupo = validas[0];
    usadosBanco.add(movimientoBanco.id);
    grupo.forEach((movimiento) => usadosPlanilla.add(movimiento.id));
    resultados.push(resultadoCruce([movimientoBanco], grupo, 'uno_a_muchos'));
  }

  // 4. Muchos a uno.
  for (const movimientoPlanilla of planilla) {
    if (usadosPlanilla.has(movimientoPlanilla.id)) continue;
    const posibles = banco
      .filter(
        (movimientoBanco) =>
          !usadosBanco.has(movimientoBanco.id) &&
          mismoSigno(movimientoBanco.centavos, movimientoPlanilla.centavos) &&
          diferenciaDias(movimientoBanco.fecha, movimientoPlanilla.fecha) <=
            config.ventanaAgrupadoDias &&
          clienteCompatible(movimientoBanco, movimientoPlanilla, config),
      )
      .slice(0, 12);
    const validas = combinaciones(posibles, 2, config.maxAgrupados).filter((grupo) => {
      const suma = grupo.reduce((total, m) => total + m.centavos, 0);
      return (
        Math.abs(suma - movimientoPlanilla.centavos) <=
        toleranciaPermitida(movimientoPlanilla.centavos, config)
      );
    });
    if (validas.length !== 1) continue;
    const grupo = validas[0];
    grupo.forEach((movimiento) => usadosBanco.add(movimiento.id));
    usadosPlanilla.add(movimientoPlanilla.id);
    resultados.push(resultadoCruce(grupo, [movimientoPlanilla], 'muchos_a_uno'));
  }

  // 5. Gastos bancarios, solo negativos y después de todos los cruces.
  const reglasGasto = entrada.reglas
    .filter((regla) => regla.accion === 'gasto_bancario')
    .map((regla) => ({ ...regla, patron: normalizarTexto(regla.patron) }));
  for (const movimientoBanco of banco) {
    if (usadosBanco.has(movimientoBanco.id) || movimientoBanco.centavos >= 0) continue;
    const regla = reglasGasto.find((candidata) => movimientoBanco.texto.includes(candidata.patron));
    if (!regla) continue;
    usadosBanco.add(movimientoBanco.id);
    resultados.push({
      id: '',
      estado: 'gasto_bancario',
      paso: 'regla',
      banco: [movimientoBanco.id],
      planilla: [],
      diferenciaCentavos: movimientoBanco.centavos,
      puntaje: 1,
      nota: `Gasto bancario detectado por la regla “${regla.patron}”`,
    });
  }

  // 6. Dudosos y hasta tres candidatos explicados.
  for (const movimientoBanco of banco) {
    if (usadosBanco.has(movimientoBanco.id)) continue;
    const candidatos: Array<Candidato & { orden: string }> = planilla
      .filter(
        (movimientoPlanilla) =>
          !usadosPlanilla.has(movimientoPlanilla.id) &&
          mismoSigno(movimientoBanco.centavos, movimientoPlanilla.centavos),
      )
      .map((movimientoPlanilla) => {
        const valor = puntuar(movimientoBanco, movimientoPlanilla);
        const pagoParcial =
          movimientoBanco.cliente &&
          movimientoPlanilla.cliente &&
          normalizarTexto(movimientoBanco.cliente) ===
            normalizarTexto(movimientoPlanilla.cliente) &&
          Math.abs(movimientoBanco.centavos) < Math.abs(movimientoPlanilla.centavos);
        return {
          planilla: [movimientoPlanilla.id],
          puntaje: valor,
          motivo: pagoParcial
            ? `Posible pago parcial: faltan $ ${formatoMonto(movimientoPlanilla.centavos - movimientoBanco.centavos)}`
            : `Monto, fecha y texto tienen ${Math.round(valor * 100)}% de coincidencia`,
          orden: movimientoPlanilla.id,
        };
      })
      .filter((candidato) => candidato.puntaje >= config.puntajeMinDudoso)
      .sort((a, b) => b.puntaje - a.puntaje || compararTexto(a.orden, b.orden));
    if (candidatos.length === 0) continue;
    usadosBanco.add(movimientoBanco.id);
    resultados.push({
      id: '',
      estado: 'dudoso',
      banco: [movimientoBanco.id],
      planilla: [],
      diferenciaCentavos: movimientoBanco.centavos,
      puntaje: candidatos[0].puntaje,
      nota: 'Necesita revisión de una persona',
      candidatos: candidatos.slice(0, 3).map((candidato) => ({
        planilla: candidato.planilla,
        puntaje: candidato.puntaje,
        motivo: candidato.motivo,
      })),
    });
  }

  // 7. Resto con una sugerencia útil.
  for (const movimientoBanco of banco) {
    if (usadosBanco.has(movimientoBanco.id)) continue;
    resultados.push({
      id: '',
      estado: 'solo_banco',
      banco: [movimientoBanco.id],
      planilla: [],
      diferenciaCentavos: movimientoBanco.centavos,
      puntaje: 0,
      nota:
        movimientoBanco.centavos > 0
          ? 'Ingreso sin registrar en la planilla: ¿falta cargarlo?'
          : Math.abs(movimientoBanco.centavos) < 100_000
            ? '¿Gasto bancario? Podés crear una regla'
            : 'Egreso del banco sin movimiento en la planilla',
    });
  }
  const ultimaFechaBanco = banco
    .map((movimiento) => movimiento.fecha)
    .sort(compararTexto)
    .at(-1);
  for (const movimientoPlanilla of planilla) {
    if (usadosPlanilla.has(movimientoPlanilla.id)) continue;
    resultados.push({
      id: '',
      estado: 'solo_planilla',
      banco: [],
      planilla: [movimientoPlanilla.id],
      diferenciaCentavos: -movimientoPlanilla.centavos,
      puntaje: 0,
      nota:
        ultimaFechaBanco && movimientoPlanilla.fecha > ultimaFechaBanco
          ? 'Posterior al cierre del extracto: probablemente aparece el mes que viene'
          : movimientoPlanilla.centavos > 0
            ? 'Cobro registrado que no aparece en el banco: verificar si se depositó'
            : 'Egreso registrado que no aparece en el banco',
    });
  }

  resultados.forEach((resultado, indice) => {
    resultado.id = `R-${String(indice + 1).padStart(4, '0')}`;
  });
  return { resultados, resumen: calcularResumen(resultados, banco, planilla) };
}

export function aceptarDudoso(entrada: {
  resultados: Resultado[];
  resultadoId: string;
  indiceCandidato: number;
  banco: Movimiento[];
  planilla: Movimiento[];
}): { resultados: Resultado[]; resumen: Resumen; reglaSugerida?: Regla } {
  const original = entrada.resultados.find((resultado) => resultado.id === entrada.resultadoId);
  const candidato = original?.candidatos?.[entrada.indiceCandidato];
  if (!original || original.estado !== 'dudoso' || !candidato) {
    throw new Error('El candidato dudoso no existe');
  }
  const movimientoBanco = entrada.banco.find((movimiento) => movimiento.id === original.banco[0]);
  const movimientosPlanilla = candidato.planilla
    .map((id) => entrada.planilla.find((movimiento) => movimiento.id === id))
    .filter((movimiento): movimiento is Movimiento => Boolean(movimiento));
  if (!movimientoBanco || movimientosPlanilla.length !== candidato.planilla.length) {
    throw new Error('No se encontraron los movimientos del candidato');
  }
  const reemplazo = resultadoCruce([movimientoBanco], movimientosPlanilla, 'manual');
  reemplazo.id = original.id;
  reemplazo.nota = 'Conciliado manualmente';
  const resultados = entrada.resultados.map((resultado) =>
    resultado.id === original.id ? reemplazo : { ...resultado },
  );
  const cliente = movimientosPlanilla[0]?.cliente;
  const patron = palabrasUtiles(movimientoBanco.texto)
    .filter((palabra) => !/^\d{7,}$/.test(palabra))
    .join(' ');
  const reglaSugerida =
    cliente && patron
      ? {
          id: `RR-${movimientoBanco.id}`,
          patron,
          accion: 'asignar_cliente' as const,
          cliente,
          origen: 'revision' as const,
        }
      : undefined;
  return {
    resultados,
    resumen: calcularResumen(resultados, entrada.banco, entrada.planilla),
    reglaSugerida,
  };
}
