/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      stream: false,
      crypto: false,
    }
    // Use memory-only cache in dev to prevent filesystem cache corruption
    if (dev) {
      config.cache = { type: 'memory' }
    }
    return config
  },
}

export default nextConfig
