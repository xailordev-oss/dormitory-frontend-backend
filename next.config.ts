import type { NextConfig } from "next";

/**
 * Frontend ເອີ້ນ /api/* ແລະ /uploads/* ຢູ່ domain ດຽວກັນ ແລ້ວ Next.js ສົ່ງຕໍ່ (proxy) ໄປຫາ backend
 * → ບໍ່ຕ້ອງຕັ້ງ CORS ຢູ່ backend ແລະ ບໍ່ມີບັນຫາ cross-origin
 * ປ່ຽນທີ່ຢູ່ backend ໄດ້ດ້ວຍ BACKEND_URL ໃນ .env.local
 */
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
      { source: "/backend-health", destination: `${BACKEND_URL}/health` },
    ];
  },
};

export default nextConfig;
