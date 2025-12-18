import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingIncludes: {
    "*": [
      "public/**/*", 
      ".next/static/**/*", 
      "node_modules/.bin/drizzle-kit", 
      "node_modules/drizzle-orm/**/*", 
      "node_modules/drizzle-kit/**/*", 
      "node_modules/@electric-sql/pglite/dist/**/*"
    ],
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
