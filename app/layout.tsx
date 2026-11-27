import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ProveedorAplicacion } from '@/components/app-provider';
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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="es-UY"
      className="m-enter"
      data-type="software"
      data-radius="soft"
      data-buttons="arrow"
    >
      <body>
        <ProveedorAplicacion>{children}</ProveedorAplicacion>
      </body>
    </html>
  );
}
