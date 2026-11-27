import { describe, expect, it } from 'vitest';
import { crearSolicitudIA, incorporarSugerenciasIA } from '@/lib/ia/cliente';
import { resolverConfiguracionIA } from '@/lib/ia';
import type { DatosConciliacion } from '@/lib/worker/protocolo';

const datos = {
  movimientosBanco: [
    { id: 'B1', origen: 'banco', fecha: '2026-11-27', descripcion: 'Depósito', texto: 'deposito', centavos: 120_00, moneda: 'UYU', fila: 2, referencia: 'secreta' },
  ],
  movimientosPlanilla: [
    { id: 'P1', origen: 'planilla', fecha: '2026-11-27', descripcion: 'Cobro local', texto: 'cobro local', centavos: 120_00, moneda: 'UYU', cliente: 'Cliente Demo', fila: 2 },
  ],
  resultados: [
    { id: 'R1', estado: 'dudoso', banco: ['B1'], planilla: [], diferenciaCentavos: 0, puntaje: 0.8, nota: 'Revisar', candidatos: [{ planilla: ['P1'], puntaje: 0.8, motivo: 'Monto igual' }] },
  ],
} as unknown as DatosConciliacion;

describe('configuración de IA', () => {
  it('queda apagada por defecto y rechaza placeholders o configuración incompleta', () => {
    expect(resolverConfiguracionIA({})).toBeNull();
    expect(resolverConfiguracionIA({ habilitada: 'false', modelo: 'gemini-2.5-flash', claveGemini: 'real' })).toBeNull();
    expect(resolverConfiguracionIA({ habilitada: 'true', modelo: 'modelo-falso', claveGemini: 'clave-falsa-no-usar' })).toBeNull();
  });

  it('sólo se activa con opt-in y configuración completa', () => {
    expect(resolverConfiguracionIA({ habilitada: 'true', modelo: 'gemini-2.5-flash', claveGemini: 'clave-prueba-valida' })).toEqual({
      modelo: 'gemini-2.5-flash',
      claveGemini: 'clave-prueba-valida',
    });
  });
});

describe('cliente de IA', () => {
  it('envía sólo los campos mínimos y no expone ids, referencias, texto ni filas', () => {
    const solicitud = crearSolicitudIA(datos);
    expect(solicitud?.resultadoIds).toEqual(['R1']);
    expect(solicitud?.cuerpo).toEqual({
      dudosos: [{
        banco: { fecha: '2026-11-27', descripcion: 'Depósito', montoCentavos: 120_00 },
        candidatos: [{ planilla: [{ fecha: '2026-11-27', descripcion: 'Cobro local', montoCentavos: 120_00, cliente: 'Cliente Demo' }] }],
      }],
    });
    expect(JSON.stringify(solicitud?.cuerpo)).not.toMatch(/B1|P1|secreta|texto|fila/);
  });

  it('guarda una sugerencia válida sin aceptar ni cambiar el estado dudoso', () => {
    const resultado = incorporarSugerenciasIA(datos.resultados, ['R1'], {
      sugerencias: [{ indice: 0, confianza: 0.91, motivo: 'Coinciden monto y fecha' }],
    });
    expect(resultado[0]).toMatchObject({
      estado: 'dudoso',
      sugerenciaIA: { indice: 0, confianza: 0.91, motivo: 'Coinciden monto y fecha' },
    });
  });

  it('ignora una salida inválida sin alterar los resultados', () => {
    expect(incorporarSugerenciasIA(datos.resultados, ['R1'], {
      sugerencias: [{ indice: 99, confianza: 2, motivo: '' }],
    })).toBe(datos.resultados);
  });
});
