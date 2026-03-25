import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles optimization automatically
  // If deploying elsewhere as static, uncomment: output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
