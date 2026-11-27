import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), 'utf8');
}

describe('pulido de Fase 4', () => {
  it('mantiene la IA apagada y avisa que la decisión sigue siendo humana', () => {
    const entorno = leer('.env.example');
    const resultados = leer('components/vista-resultados.tsx');
    expect(entorno).toContain('AI_ENABLED=false');
    expect(resultados).toContain('La IA sólo propone: cada movimiento seguirá como dudoso');
    expect(resultados).toContain('Con datos reales de clientes, usá solo un proveedor que no entrene con tus datos (plan pago)');
  });

  it('no permite que los tests apunten al proveedor real', () => {
    const pruebas = ['tests/ia.test.ts', 'tests/api-ia.test.ts']
      .map(leer)
      .join('\n');
    expect(pruebas).toContain('ProveedorIAFalso');
    expect(pruebas).not.toContain('ProveedorGemini');
    expect(pruebas).not.toContain('generativelanguage.googleapis.com');
  });

  it('usa fuentes locales y semántica accesible en los resultados', () => {
    const estilos = leer('app/globals.css');
    const resultados = leer('components/vista-resultados.tsx');
    expect(estilos).not.toContain('fonts.googleapis.com');
    expect(estilos).toContain(':focus-visible');
    expect(resultados).toContain('aria-pressed={pestana ===');
    expect(resultados).toContain('<th scope="col">');
    expect(resultados).toContain('aria-live="polite"');
  });

  it('documenta el portfolio en el orden pedido y con diagrama Mermaid', () => {
    const readme = leer('README.md');
    const titulos = [
      '## El problema',
      '## Demo en vivo',
      '## Cómo funciona',
      '## Decisiones técnicas',
      '## Seguridad y privacidad',
      '## Correr localmente',
      '## Estructura y cobertura',
      '## Roadmap',
      '## Autor',
      '## Licencia',
    ];
    const posiciones = titulos.map((titulo) => readme.indexOf(titulo));
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
    expect(readme).toContain('docs/demo.gif');
    expect(readme).toContain('```mermaid');
    expect(readme).toContain('© 2026 RAON. Todos los derechos reservados. El código se publica para mostrar el trabajo; para usarlo en tu negocio, contactanos.');
  });
});
