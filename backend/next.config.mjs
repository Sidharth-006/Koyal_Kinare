/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["argon2", "pg", "pino"]
  }
};

export default nextConfig;
