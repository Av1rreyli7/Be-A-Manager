import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The production build checks types with tsconfig.build.json, which leaves the test files out.
  // Test tools are dev dependencies, and a host like Render may install without them.
  // npm run typecheck still checks everything, tests included.
  typescript: { tsconfigPath: "tsconfig.build.json" },
};

export default nextConfig;
