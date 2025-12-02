import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingIncludes: {
    "*": ["public/**/*", ".next/static/**/*"],
  },
  serverExternalPackages: ["electron"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

if (process.env.NODE_ENV !== "production") delete nextConfig.output; // for HMR

export default nextConfig;
