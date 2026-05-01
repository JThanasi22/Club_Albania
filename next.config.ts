import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-lib", "@pdf-lib/fontkit", "sharp"],
  outputFileTracingIncludes: {
    "/api/players/[id]/payment-pdf": [
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-BoldOblique.ttf",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
