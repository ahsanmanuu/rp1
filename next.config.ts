import type { NextConfig } from "next";
import path from "path";

// Configure threadpool size safely without overloading low-memory environments (like cPanel)
if (typeof process !== 'undefined' && process.env.CPANEL_BUILD !== 'true') {
  if (!process.env.UV_THREADPOOL_SIZE) {
    process.env.UV_THREADPOOL_SIZE = "16";
  }
}

// True when building inside the memory-constrained cPanel shared hosting:
// enables every trick we have to keep peak memory under the container limit.
const IS_CONSTRAINED =
  process.env.CPANEL_BUILD === 'true' ||
  Boolean(process.env.NODE_OPTIONS?.includes('max-old-space-size='));

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: IS_CONSTRAINED ? [] : ['pdfjs-dist'],
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
      {
        protocol: 'https',
        hostname: 'brand.ieee.org',
      },
      {
        protocol: 'https',
        hostname: 'www.cambridge.org',
      },
      {
        protocol: 'https',
        hostname: '*.nature.com',
      },
      {
        protocol: 'https',
        hostname: '*.springer.com',
      },
      {
        protocol: 'https',
        hostname: '*.springeropen.com',
      },
      {
        protocol: 'https',
        hostname: '*.acm.org',
      },
      {
        protocol: 'https',
        hostname: '*.wiley.com',
      },
      {
        protocol: 'https',
        hostname: '*.tandfonline.com',
      },
      {
        protocol: 'https',
        hostname: '*.sagepub.com',
      },
      {
        protocol: 'https',
        hostname: '*.oup.com',
      },
      {
        protocol: 'https',
        hostname: '*.sciencedirect.com',
      },
      {
        protocol: 'https',
        hostname: '*.arxiv.org',
      },
      {
        protocol: 'https',
        hostname: '*.mdpi.com',
      },
      {
        protocol: 'https',
        hostname: '*.frontiersin.org',
      },
      {
        protocol: 'https',
        hostname: '*.plos.org',
      },
      {
        protocol: 'https',
        hostname: '*.biorxiv.org',
      },
      {
        protocol: 'https',
        hostname: '*.researchgate.net',
      },
      {
        protocol: 'https',
        hostname: '*.semanticscholar.org',
      },
      {
        protocol: 'https',
        hostname: 'journals.aps.org',
      },
      {
        protocol: 'https',
        hostname: 'journals.aas.org',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'publishing.aip.org',
      },
      {
        protocol: 'https',
        hostname: 'iopscience.iop.org',
      },
      {
        protocol: 'https',
        hostname: 'www.ams.org',
      },
      {
        protocol: 'https',
        hostname: 'www.siam.org',
      },
      {
        protocol: 'https',
        hostname: 'pubs.acs.org',
      },
    ],
  },
  // Keep Prisma + heavy server-side dependencies external on the server: stop
  // webpack/Turbopack from parsing/bundling giant graphs (jsdom alone is ~1000 files).
  // They are copied into the standalone output at runtime instead. Only the
  // server compilation is affected; client bundles still compile them normally.
  serverExternalPackages: [
    '@prisma/client', '.prisma/client', '@auth/prisma-adapter', 'sharp', 'better-sqlite3', 'adm-zip', 'original-fs',
    'jsdom', 'mammoth', 'docx', 'pdf-lib', 'pdf-parse', 'nodemailer', 'bcryptjs', 'jsonwebtoken',
    'jose', 'multer', 'archiver', 'xlsx', 'jszip', 'katex', 'mathml-to-latex', 'uuid', 'pocketbase',
  ],
  // Skip build-time asset gzipping on cPanel (streams hold whole assets in memory
  // at the end of the build). LiteSpeed gzips responses at the edge anyway.
  compress: !IS_CONSTRAINED,
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
          { key: 'Content-Security-Policy', value: "default-src 'self' https: http: data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https: http:; font-src 'self' data: https:; connect-src 'self' https: http: wss: ws:;" },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },

  experimental: {
    cpus: 1,
    workerThreads: false,
    // Keeps webpack's string-cache pooling small — real peak-memory win on
    // tight cPanel containers (Next 16 supports this natively).
    webpackMemoryOptimizations: IS_CONSTRAINED,
    serverActions: {
      bodySizeLimit: '100mb',
    },
    proxyClientMaxBodySize: '100mb',
    // Trim the heavy barrels for constrained builds: analyzing every export of
    // recharts/pdfjs-dist during the build inflates memory a lot. NOTE: Next
    // applies its OWN built-in list when the key is missing, so an explicit
    // empty array is required to truly disable it.
    optimizePackageImports: IS_CONSTRAINED
      ? []
      : ['pdfjs-dist', 'framer-motion', 'lucide-react', 'recharts', '@statelyai/graph'],
  },
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    config.parallelism = IS_CONSTRAINED ? 1 : 50;

    // Skip JS/CSS minification on cPanel builds: SWC/Terser holding every
    // chunk in memory simultaneously is the single biggest peak-memory spike.
    // Also skip scope-hoisting (module concatenation) — same reason.
    if (IS_CONSTRAINED && config.optimization) {
      config.optimization.minimize = false;
      config.optimization.concatenateModules = false;
    }

    // Disable parallel worker processes during cPanel builds to prevent SIGKILL 137
    if (config.optimization && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((minimizer: any) => {
        if (minimizer.options) {
          minimizer.options.parallel = IS_CONSTRAINED ? false : true;
        }
      });
    }

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
