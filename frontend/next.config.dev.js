/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable in dev for faster reloads
  swcMinify: false, // Disable minification in dev
  compress: false, // Disable compression in dev
  poweredByHeader: false,
  generateEtags: false, // Disable etags in dev

  // Simplified webpack for development
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      // Skip all optimizations in development
      config.optimization = {
        ...config.optimization,
        minimize: false,
        splitChunks: false,
      };

      // Faster source maps
      config.devtool = 'eval-cheap-module-source-map';

      return config;
    }

    return config;
  },

  // Disable TypeScript checking in dev
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable ESLint in dev
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable image optimization in dev
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
};

module.exports = nextConfig;
