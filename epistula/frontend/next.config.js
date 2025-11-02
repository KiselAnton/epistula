/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Performance optimizations
  swcMinify: true, // Use SWC for faster minification
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // Remove console.logs in production
  },
  
  // Enable compression
  compress: true,
  
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Production source maps (disable for faster builds)
  productionBrowserSourceMaps: false,
  
  // Optimize fonts
  optimizeFonts: true,
  
  // HTTP headers for caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL,
    NEXT_PUBLIC_ROOT_EMAIL: process.env.NEXT_PUBLIC_ROOT_EMAIL || process.env.EPISTULA_ROOT_EMAIL || 'root@localhost.localdomain',
  },

  // Map /favicon.ico to a generated API response so browsers don't 404
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/api/favicon',
      },
    ];
  },
}

module.exports = nextConfig
