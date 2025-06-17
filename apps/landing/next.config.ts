import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.teqo.app/:path*",
      },
    ];
  },
};

export default nextConfig;
