import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conciliación bancaria | RAON',
  description: 'Conciliación bancaria para fondos de terceros.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-UY">
      <body>{children}</body>
    </html>
  );
}
