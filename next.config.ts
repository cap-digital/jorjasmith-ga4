import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  serverExternalPackages: ["@google-analytics/data"],
  partialPrefetching: true,
  experimental: {
    // The persistent cache serves stale CSS through the @tailwindcss/turbopack loader: on Vercel it
    // restored the previous deploy's globals.css, and in dev it missed globals.css edits. Compile fresh.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
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
