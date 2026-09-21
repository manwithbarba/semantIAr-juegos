import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: isGithubActions ? "/semantIAr-juegos" : "",
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  basePath: isGithubActions ? "/semantIAr-juegos" : undefined,
};

export default nextConfig;
