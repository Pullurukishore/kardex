const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  experimental: {
    // Next.js 14 native optimization for large libraries
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      'chart.js',
      'react-chartjs-2',
      '@radix-ui/react-icons',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'sonner',
      'clsx',
      'tailwind-merge',
      'axios',
      'cookies-next',
      'zod',
      'xlsx',
      'exceljs',
      'jspdf',
      'leaflet',
      'docx'
    ],
  },




  webpack: (config, { isServer }) => {
    // Add asset loaders for fonts
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/i,
      type: 'asset/resource',
    });

    // Handle polyfills for libs like xlsx/exceljs/docx
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      module: false,
      net: false,
      dns: false,
      child_process: false,
      tls: false,
    };

    return config;
  },

  productionBrowserSourceMaps: false,
  compiler: {
    // Optimized for Tailwind-based project
    removeConsole: process.env.NEXT_PUBLIC_ENABLE_LOGS !== 'true' ? { exclude: ['error'] } : false,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003',
  },
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  trailingSlash: false,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '172.28.91.10',
      },
      {
        protocol: 'http',
        hostname: '10.91.1.12',
      },
      {
        protocol: 'https',
        hostname: '*.run.app',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    unoptimized: process.env.NEXT_EXPORT === 'true',
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  devIndicators: {
    position: 'bottom-right',
  },
}

module.exports = withBundleAnalyzer(nextConfig)

