import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./lib/qrcode/fonts/NotoSans-Regular.ttf"],
  },
};

export default nextConfig;
