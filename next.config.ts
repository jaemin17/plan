import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const isUserOrOrgPagesSite = repositoryName.endsWith(".github.io");
const basePath =
  isGitHubPages && repositoryName && !isUserOrOrgPagesSite
    ? `/${repositoryName}`
    : undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath ?? "",
  },
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
