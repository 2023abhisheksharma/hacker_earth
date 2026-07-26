import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/demo-form",
        destination: "http://localhost:3005/",
      },
      {
        source: "/socket.io",
        destination: "http://localhost:3004/",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3004/:path*",
      },
    ];
  },
};

export default nextConfig;
