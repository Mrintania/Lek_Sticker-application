/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    // ลด module count ต่อ route โดย tree-shake package ใหญ่ๆ
    // ป้องกัน webpack chunk reorganization ที่ทำให้ app/layout.js 404
    optimizePackageImports: ['recharts', 'date-fns', 'exceljs'],
  },
}

export default nextConfig
