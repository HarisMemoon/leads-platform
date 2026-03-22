import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_URL;

    return [
      {
        source: "/api/auth/:path*",
        destination: `${base}/auth/:path*`,
      },
      {
        source: "/api/onboarding/:path*",
        destination: `${base}/onboarding/:path*`,
      },
      {
        source: "/api/wallet/:path*",
        destination: `${base}/wallet/:path*`,
      },
    ];
  },
};

export default nextConfig;