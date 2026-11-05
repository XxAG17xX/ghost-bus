import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // the little next.js badge sat on top of my stop button
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
