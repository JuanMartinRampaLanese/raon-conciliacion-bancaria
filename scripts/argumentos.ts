import { basename, extname } from 'node:path';

export function parsearArgumentos(argv: string[]): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (let indice = 0; indice < argv.length; indice += 1) {
    const clave = argv[indice];
    if (!clave.startsWith('--') || !argv[indice + 1]) continue;
    resultado[clave.slice(2)] = argv[indice + 1];
    indice += 1;
  }
  return resultado;
}

export function resolverNombreBanco(args: Record<string, string>): string {
  return args['nombre-banco']?.trim() || basename(args.banco, extname(args.banco));
}
