import { describe, expect, it } from 'vitest';
import type { ProveedorIA } from '@/lib/ia';
import type { RespuestaIA, SolicitudIA } from '@/lib/ia/esquemas';
import { crearManejadorIA } from '@/lib/ia/route';

class ProveedorIAFalso implements ProveedorIA {
  llamadas = 0;
  constructor(private readonly responder: (signal: AbortSignal) => Promise<RespuestaIA>) {}
  async sugerir(_solicitud: SolicitudIA, signal: AbortSignal): Promise<RespuestaIA> {
    this.llamadas += 1;
    return this.responder(signal);
  }
}

const dudoso = {
  banco: { fecha: '2026-11-27', descripcion: 'Depósito', montoCentavos: 100_00 },
  candidatos: [{ planilla: [{ fecha: '2026-11-27', descripcion: 'Cobro', montoCentavos: 100_00 }] }],
};

function request(cuerpo: unknown): Request {
  return new Request('http://localhost/api/ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

function dependencias(
  proveedor: ProveedorIA,
  cambios: Partial<Parameters<typeof crearManejadorIA>[0]> = {},
): Parameters<typeof crearManejadorIA>[0] {
  return {
    habilitada: true,
    proveedor,
    autenticar: async () => '00000000-0000-4000-8000-00000000000a',
    consumirCuota: async () => true,
    ...cambios,
  };
}

describe('/api/ia', () => {
  it('apagado devuelve 404 y no llama al proveedor falso', async () => {
    const proveedor = new ProveedorIAFalso(async () => ({ sugerencias: [] }));
    const respuesta = await crearManejadorIA(dependencias(proveedor, { habilitada: false }))(request({ dudosos: [dudoso] }));
    expect(respuesta.status).toBe(404);
    expect(proveedor.llamadas).toBe(0);
  });

  it('sin sesión devuelve 401 sin consumir cuota ni llamar al proveedor falso', async () => {
    let cuotas = 0;
    const proveedor = new ProveedorIAFalso(async () => ({ sugerencias: [] }));
    const respuesta = await crearManejadorIA(dependencias(proveedor, {
      autenticar: async () => null,
      consumirCuota: async () => {
        cuotas += 1;
        return true;
      },
    }))(request({ dudosos: [dudoso] }));
    expect(respuesta.status).toBe(401);
    expect(cuotas).toBe(0);
    expect(proveedor.llamadas).toBe(0);
  });

  it('al superar la cuota devuelve 429 sin llamar al proveedor falso', async () => {
    const proveedor = new ProveedorIAFalso(async () => ({ sugerencias: [] }));
    const respuesta = await crearManejadorIA(dependencias(proveedor, {
      consumirCuota: async () => false,
    }))(request({ dudosos: [dudoso] }));
    expect(respuesta.status).toBe(429);
    expect(proveedor.llamadas).toBe(0);
  });

  it('rechaza más de 50 dudosos antes de invocar al proveedor', async () => {
    const proveedor = new ProveedorIAFalso(async () => ({ sugerencias: [] }));
    const respuesta = await crearManejadorIA(dependencias(proveedor))(request({ dudosos: Array.from({ length: 51 }, () => dudoso) }));
    expect(respuesta.status).toBe(400);
    expect(proveedor.llamadas).toBe(0);
  });

  it('devuelve la sugerencia del proveedor falso con salida válida', async () => {
    const proveedor = new ProveedorIAFalso(async () => ({
      sugerencias: [{ indice: 0, confianza: 0.88, motivo: 'Coinciden fecha y monto' }],
    }));
    const respuesta = await crearManejadorIA(dependencias(proveedor))(request({ dudosos: [dudoso] }));
    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      sugerencias: [{ indice: 0, confianza: 0.88, motivo: 'Coinciden fecha y monto' }],
    });
  });

  it('rechaza una salida con un candidato inexistente', async () => {
    const proveedor = new ProveedorIAFalso(async () => ({
      sugerencias: [{ indice: 1, confianza: 0.75, motivo: 'Índice inválido para este caso' }],
    }));
    const respuesta = await crearManejadorIA(dependencias(proveedor))(request({ dudosos: [dudoso] }));
    expect(respuesta.status).toBe(502);
  });

  it('aborta al superar el timeout sin esperar un proveedor real', async () => {
    let abortada = false;
    const proveedor = new ProveedorIAFalso((signal) => new Promise((_resolver, rechazar) => {
      signal.addEventListener('abort', () => {
        abortada = true;
        rechazar(new Error('abortada'));
      });
    }));
    const respuesta = await crearManejadorIA(dependencias(proveedor, { timeoutMs: 10 }))(request({ dudosos: [dudoso] }));
    expect(respuesta.status).toBe(504);
    expect(abortada).toBe(true);
  });
});
