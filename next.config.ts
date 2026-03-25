import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages and Cloudflare Pages
  output: 'export',
  images: { unoptimized: true },
  // Base path for GitHub Pages
  basePath: process.env.CF_PAGES ? '' : '/menu-sync-tool',
  // Asset prefix for GitHub Pages
  assetPrefix: process.env.CF_PAGES ? '' : '/menu-sync-tool',
};

export default nextConfig;
