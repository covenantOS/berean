import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**": ["./data/kjv/*.json"],
  },
};

export default nextConfig;
