/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL,
    NEXT_PUBLIC_ROOT_EMAIL: process.env.NEXT_PUBLIC_ROOT_EMAIL || process.env.EPISTULA_ROOT_EMAIL || 'root@localhost.localdomain',
  },
}

module.exports = nextConfig
