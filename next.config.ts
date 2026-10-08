import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  serverExternalPackages: ["@google-analytics/data"],
  partialPrefetching: true,
  experimental: {
    // The restored build cache (.next/cache on Vercel) served the previous deploy's CSS
    // through the @tailwindcss/turbopack loader. Always compile builds from scratch.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
