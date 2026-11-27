import type { NextConfig } from 'next';
import { crearCabecerasSeguridad } from './lib/seguridad/headers';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: crearCabecerasSeguridad(),
      },
    ];
  },
};

export default nextConfig;
