import type { NextConfig } from 'next';

const backendOrigin = process.env.BACKEND_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendOrigin) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${backendOrigin}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
