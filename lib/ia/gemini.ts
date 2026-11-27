import { respuestaIAEsquema, type RespuestaIA, type SolicitudIA } from '@/lib/ia/esquemas';
import type { ProveedorIA } from '@/lib/ia';

const respuestaGeminiEsquema = {
  type: 'object',
  properties: {
    sugerencias: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        properties: {
          indice: { type: ['integer', 'null'], minimum: 0, maximum: 2 },
          confianza: { type: 'number', minimum: 0, maximum: 1 },
          motivo: { type: 'string' },
        },
        required: ['indice', 'confianza', 'motivo'],
        additionalProperties: false,
      },
    },
  },
  required: ['sugerencias'],
  additionalProperties: false,
} as const;

interface RespuestaGemini {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export class ProveedorGemini implements ProveedorIA {
  constructor(
    private readonly modelo: string,
    private readonly clave: string,
    private readonly hacerFetch: typeof fetch = fetch,
  ) {}

  async sugerir(solicitud: SolicitudIA, signal: AbortSignal): Promise<RespuestaIA> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`;
    const respuesta = await this.hacerFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.clave,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Sugerí, en el mismo orden, el índice del candidato que probablemente corresponda a cada movimiento bancario. Usá null si ninguno es suficientemente confiable. No cambies importes ni inventes datos.\n' +
                  JSON.stringify(solicitud),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: respuestaGeminiEsquema,
        },
      }),
      signal,
    });
    if (!respuesta.ok) throw new Error('El proveedor de IA no respondió correctamente');
    const cuerpo = (await respuesta.json()) as RespuestaGemini;
    const texto = cuerpo.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) throw new Error('El proveedor de IA devolvió una respuesta vacía');
    return respuestaIAEsquema.parse(JSON.parse(texto));
  }
}
