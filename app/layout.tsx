import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { ProveedorAplicacion } from '@/components/app-provider';
import { resolverConfiguracionIA } from '@/lib/ia';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conciliación bancaria | RAON',
  description:
    'Conciliá el extracto del banco con tu planilla y calculá los fondos de cada cliente sin subir archivos.',
  other: {
    'page-type': 'software',
    'site-kind': 'software',
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const iaHabilitada = resolverConfiguracionIA() !== null;
  return (
    <html
      lang="es-UY"
      className="m-enter"
      data-type="software"
      data-radius="soft"
      data-buttons="arrow"
    >
      <body>
        <ProveedorAplicacion iaHabilitada={iaHabilitada}>{children}</ProveedorAplicacion>
      </body>
    </html>
  );
}
