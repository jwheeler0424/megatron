import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "*": ["/src/public/**/*", ".next/static/**/*"],
  },
  serverExternalPackages: ["electron"],
  images: {
    unoptimized: true,
  },
};

if (process.env.NODE_ENV === "development") delete nextConfig.output; // for HMR

export default nextConfig;
