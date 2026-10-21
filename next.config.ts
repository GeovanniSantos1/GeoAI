import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // O cache em disco do Turbopack no build, restaurado pela Vercel entre deploys, publicou o globals.css antigo
    // (sem o bloco do Foco) depois do merge do PR #11. Sem ele, cada build compila o CSS do zero.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
