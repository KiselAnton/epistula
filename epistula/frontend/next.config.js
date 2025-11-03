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
    // Ensure a concrete string to satisfy Next.js config validation
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000',
    // Align with the root user email already created in the database
    NEXT_PUBLIC_ROOT_EMAIL: process.env.NEXT_PUBLIC_ROOT_EMAIL || process.env.EPISTULA_ROOT_EMAIL || 'root@localhost.localdomain',
  },

  // Map /favicon.ico to a generated API response so browsers don't 404
  // Proxy /storage/* to backend for file serving
  async rewrites() {
    // For server-side rewrites (running in Docker), use internal network address
    // Falls back to localhost for local development
    const internalBackendUrl = process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/favicon.ico',
        destination: '/api/favicon',
      },
      {
        source: '/storage/:path*',
        destination: `${internalBackendUrl}/storage/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
