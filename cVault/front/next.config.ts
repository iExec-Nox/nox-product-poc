import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't climb up to
  // `/Users/robin/Documents/Nox/package-lock.json` (an unrelated lockfile in a parent dir).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
