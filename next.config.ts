import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['pdfjs-dist'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'www.elsevier.com',
      },
    ],
  },
  // Keep all Prisma and Prisma-related dependencies external on the server to prevent bundler resolution hijacking
  serverExternalPackages: ['@prisma/client', '.prisma/client', '@auth/prisma-adapter', 'sharp', 'better-sqlite3', 'adm-zip', 'original-fs'],
  compress: true,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/amin',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/amin/:path*',
        destination: '/admin/:path*',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      // Proxy PocketBase admin UI and all its sub-paths
      {
        source: '/pb/:path*',
        destination: '/api/pb-proxy?pbpath=:path*',
      },
      {
        source: '/pb',
        destination: '/api/pb-proxy',
      },
      // Proxy PocketBase API endpoints that don't conflict with our Next.js API routes
      // (our routes use /api/admin (singular) not /api/admins (plural))
      {
        source: '/api/admins/:path*',
        destination: '/api/pb-proxy?pbpath=api/admins/:path*',
      },
      {
        source: '/api/collections/:path*',
        destination: '/api/pb-proxy?pbpath=api/collections/:path*',
      },
      {
        source: '/api/files/:path*',
        destination: '/api/pb-proxy?pbpath=api/files/:path*',
      },
      {
        source: '/api/settings/:path*',
        destination: '/api/pb-proxy?pbpath=api/settings/:path*',
      },
      {
        source: '/api/logs/:path*',
        destination: '/api/pb-proxy?pbpath=api/logs/:path*',
      },
      {
        source: '/api/backups/:path*',
        destination: '/api/pb-proxy?pbpath=api/backups/:path*',
      },
      {
        source: '/api/records/:path*',
        destination: '/api/pb-proxy?pbpath=api/records/:path*',
      },
      // Proxy PocketBase hooks/options endpoints
      {
        source: '/api/hooks/:path*',
        destination: '/api/pb-proxy?pbpath=api/hooks/:path*',
      },
      {
        source: '/api/options/:path*',
        destination: '/api/pb-proxy?pbpath=api/options/:path*',
      },
      // Proxy PocketBase admin UI pages and assets (/_/ serves the admin dashboard)
      // Note: /_next/* is NOT matched because the pattern requires /_/ (literal slash-underscore-slash),
      // while /_next/* starts with /_next/ — no conflict with Next.js internals.
      {
        source: '/_/:path*',
        destination: '/api/pb-proxy?pbpath=_/:path*',
      },
      {
        source: '/_',
        destination: '/api/pb-proxy?pbpath=_',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; frame-ancestors 'none';" },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2000mb',
    },
    optimizePackageImports: ['lucide-react', 'pdfjs-dist', 'framer-motion'],
  },
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    // Force NormalModuleReplacement for Prisma to bypass edge-light hijacked resolution
    if (webpack) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /edge\.js|wasm-compiler-edge/i,
          (resource: any) => {
            if (resource.request.includes('.prisma') || resource.context.includes('.prisma') || resource.request.includes('@prisma') || resource.context.includes('@prisma')) {
              resource.request = resource.request.replace('edge.js', 'index.js').replace('wasm-compiler-edge', 'client');
            }
          }
        )
      );
    }

    // Set up standard resolve aliases as a fallback
    config.resolve.alias = {
      ...config.resolve.alias,
      '@prisma/client$': path.resolve(process.cwd(), 'node_modules/@prisma/client/default.js'),
      '.prisma/client/default$': path.resolve(process.cwd(), 'node_modules/.prisma/client/index.js'),
      '.prisma/client$': path.resolve(process.cwd(), 'node_modules/.prisma/client/index.js'),
      '@prisma/client/edge$': path.resolve(process.cwd(), 'node_modules/@prisma/client/default.js'),
      '.prisma/client/edge$': path.resolve(process.cwd(), 'node_modules/.prisma/client/index.js'),
      '#main-entry-point': path.resolve(process.cwd(), 'node_modules/.prisma/client/index.js'),
      [path.resolve(process.cwd(), 'node_modules/.prisma/client/edge.js')]: path.resolve(process.cwd(), 'node_modules/.prisma/client/index.js'),
      [path.resolve(process.cwd(), 'node_modules/@prisma/client/edge.js')]: path.resolve(process.cwd(), 'node_modules/@prisma/client/default.js'),
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
      config.watchOptions = {
        ignored: [
          '**/public/uploads/**',
          '**/tmp/**',
          '**/node_modules/**',
          '**/.next/**',
        ],
      };
    }
    
    // Fix for pdfjs-dist and other ESM modules in node_modules
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    // Bulletproof server-side Webpack externals resolver for Prisma
    if (isServer) {
      // Force Node.js condition names on the server
      config.resolve.conditionNames = ['node', 'import', 'require'];

      // Custom externals function to intercept all Prisma requests (absolute paths or package names)
      // and prevent Webpack from bundling them
      const prismaExternalResolver = (data: any, callback: any) => {
        const request = data.request || '';
        // Match both forward slashes and backslashes to support Windows paths correctly
        // and externalize @auth/prisma-adapter to prevent edge-light resolution leak in server bundles
        if (/@prisma[\/\\]client|\.prisma[\/\\]client|@auth[\/\\]prisma-adapter/i.test(request)) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      };

      if (Array.isArray(config.externals)) {
        config.externals.unshift(prismaExternalResolver);
      } else if (config.externals) {
        config.externals = [prismaExternalResolver, config.externals];
      } else {
        config.externals = [prismaExternalResolver];
      }
    }

    return config;
  },
};

export default nextConfig;
