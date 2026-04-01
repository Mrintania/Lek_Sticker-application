/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['recharts', 'date-fns', 'exceljs'],
  },
  webpack: (config, { dev, isServer }) => {
    // Node.js built-in fallbacks for client bundles
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      stream: false,
      crypto: false,
    }

    if (dev && !isServer) {
      // ใช้ deterministic IDs แทน sequential
      // ทำให้ chunk ID ไม่เปลี่ยนเมื่อ route ใหม่ถูก compile
      // ป้องกัน app/layout.js 404 ที่เกิดจาก chunk reorganization
      config.optimization.moduleIds = 'deterministic'
      config.optimization.chunkIds = 'deterministic'
    }

    return config
  },
}

export default nextConfig
