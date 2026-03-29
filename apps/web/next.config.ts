import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Required for browser calls to /api/* → Nest. If unset, dev breaks with `undefined/subscriptions/...`.
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

    return [
      // Proxy all /api/* calls from Next app to Nest API.
      {
        source: "/api/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;