import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow hot-reload / _next asset requests from these additional origins while running `next dev`.
  // See https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: [
    '66.96.230.177:3000',        // your external IP & port
    '66.96.230.177:3000',          // whatever host is proxying requests (example shown in warning)
    '*.127.0.0.1.nip.io',          // handy wildcard for tunnelling URLs (optional)
  ],
  // Skip ESLint checks during `next build` so build won\'t fail on lint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
