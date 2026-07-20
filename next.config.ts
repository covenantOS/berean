import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server for the managed-container deploy (see DEPLOY.md): the
  // runner image ships the traced server plus data/, not full node_modules.
  output: "standalone",
  outputFileTracingIncludes: {
    "/**": ["./data/kjv/*.json"],
  },
  async redirects() {
    // Phase 1 retirement: the home page and the standalone Library page live
    // in the workspace now. The old URLs keep resolving, permanently.
    return [
      { source: "/", destination: "/workspace", permanent: true },
      { source: "/library", destination: "/workspace?tab=library", permanent: true },
    ];
  },
};

export default nextConfig;
