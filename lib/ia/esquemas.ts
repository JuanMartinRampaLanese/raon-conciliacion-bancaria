import { z } from 'zod';

export const movimientoIAEsquema = z
  .object({
    fecha: z.string().date(),
    descripcion: z.string().trim().min(1).max(500),
    montoCentavos: z.number().int().safe(),
    cliente: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const candidatoIAEsquema = z
  .object({
    planilla: z.array(movimientoIAEsquema).min(1).max(5),
  })
  .strict();

export const dudosoIAEsquema = z
  .object({
    banco: movimientoIAEsquema,
    candidatos: z.array(candidatoIAEsquema).min(1).max(3),
  })
  .strict();

export const solicitudIAEsquema = z
  .object({
    dudosos: z.array(dudosoIAEsquema).min(1).max(50),
  })
  .strict();

export const sugerenciaIAEsquema = z
  .object({
    indice: z.number().int().min(0).max(2).nullable(),
    confianza: z.number().min(0).max(1),
    motivo: z.string().trim().min(1).max(500),
  })
  .strict();

export const respuestaIAEsquema = z
  .object({
    sugerencias: z.array(sugerenciaIAEsquema).min(1).max(50),
  })
  .strict();

export type MovimientoIA = z.infer<typeof movimientoIAEsquema>;
export type SolicitudIA = z.infer<typeof solicitudIAEsquema>;
export type SugerenciaIA = z.infer<typeof sugerenciaIAEsquema>;
export type RespuestaIA = z.infer<typeof respuestaIAEsquema>;
