import type { NextConfig } from "next";

const isStatic = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
// Repo name on GitHub — site is served at https://<user>.github.io/<basePath>/
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/wealtyh";

const nextConfig: NextConfig = isStatic
  ? {
      output: "export",
      basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
