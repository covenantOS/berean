import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server for the managed-container deploy (see DEPLOY.md): the
  // runner image ships the traced server plus data/, not full node_modules.
  output: "standalone",
  // better-sqlite3 is a native module: keep it external so the standalone
  // build traces the prebuilt binary instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/**": ["./data/kjv/*.json"],
  },
  async redirects() {
    // Phase 1 retirement: the standalone Library page lives in the
    // workspace now. The old URL keeps resolving, permanently. The root is
    // the public landing (src/app/page.tsx); the workspace is one click in.
    return [
      { source: "/library", destination: "/workspace?tab=library", permanent: true },
    ];
  },
};

export default nextConfig;
