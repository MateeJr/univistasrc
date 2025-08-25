import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API & asset calls to the backend when running on Vercel / production
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://147.135.252.68:20085/api/:path*',
      },
      {
        source: '/laporan-images/:path*',
        destination: 'http://147.135.252.68:20085/laporan-images/:path*',
      },
      {
        source: '/task-images/:path*',
        destination: 'http://147.135.252.68:20085/task-images/:path*',
      },
    ];
  },
  // Allow hot-reload / _next asset requests from these additional origins while running `next dev`.
  // See https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: [
    '147.135.252.68:20085',        // your external IP & port
    '147.135.252.68:20085',          // whatever host is proxying requests (example shown in warning)
    '*.127.0.0.1.nip.io',          // handy wildcard for tunnelling URLs (optional)
  ],
  // Skip ESLint checks during `next build` so build won\'t fail on lint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
