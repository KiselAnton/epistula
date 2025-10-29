/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Ensure these are always strings to satisfy Next.js config validation
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000',
    NEXT_PUBLIC_ROOT_EMAIL: process.env.NEXT_PUBLIC_ROOT_EMAIL || process.env.EPISTULA_ROOT_EMAIL || 'root@localhost.localdomain',
  },
}

module.exports = nextConfig
