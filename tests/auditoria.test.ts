import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

function archivosCodigo(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) return archivosCodigo(ruta);
    return ['.ts', '.tsx'].includes(extname(entrada.name)) ? [ruta] : [];
  });
}

describe('auditoría general de seguridad', () => {
  it('mantiene la IA apagada y usa placeholders en el entorno de ejemplo', () => {
    const entorno = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    expect(entorno).toContain('AI_ENABLED=false');
    expect(entorno).not.toContain('AI_ENABLED=true');
    expect(entorno).toContain('clave-falsa-no-usar');
    expect(entorno).toContain('proyecto-falso.supabase.co');
  });

  it('no usa claves privilegiadas de Supabase en el código ejecutable', () => {
    const codigo = [
      ...archivosCodigo(join(process.cwd(), 'app')),
      ...archivosCodigo(join(process.cwd(), 'components')),
      ...archivosCodigo(join(process.cwd(), 'lib')),
      join(process.cwd(), 'proxy.ts'),
      join(process.cwd(), 'next.config.ts'),
    ].map((ruta) => readFileSync(ruta, 'utf8')).join('\n');
    expect(codigo).not.toContain(`service_${'role'}`);
    expect(codigo).not.toContain(`SUPABASE_${'SECRET'}_KEY`);
    expect(codigo).not.toContain(`sb_${'secret'}_`);
  });

  it('valida con Zod las entradas de los dos route handlers', () => {
    const ia = readFileSync(join(process.cwd(), 'lib', 'ia', 'route.ts'), 'utf8');
    const callback = readFileSync(
      join(process.cwd(), 'app', 'auth', 'callback', 'route.ts'),
      'utf8',
    );
    expect(ia).toContain('solicitudIAEsquema.safeParse');
    expect(callback).toContain('ParametrosCallback.safeParse');
  });

  it('no encuentra formatos de secreto conocidos en todo el historial Git', () => {
    const historial = execFileSync(
      'git',
      ['log', '-p', '--all', '--no-ext-diff', '--', '.'],
      { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    );
    const patrones = [
      new RegExp(`AI${'za'}[0-9A-Za-z_-]{30,}`),
      new RegExp(`sb_${'secret'}_[0-9A-Za-z_-]{16,}`),
      new RegExp(`-----BEGIN (?:RSA |EC |OPENSSH )?PRI${'VATE'} KEY-----`),
    ];
    for (const patron of patrones) expect(historial).not.toMatch(patron);
  });

  it('sólo rastrea el archivo de entorno de ejemplo', () => {
    const rastreados = execFileSync('git', ['ls-files'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .filter((ruta) => /(^|\/)\.env($|\.)/.test(ruta));
    expect(rastreados).toEqual(['.env.example']);
  });
});
