import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.js');

// Express API. Server-only (not NEXT_PUBLIC_) — the browser only ever sees /api/v1/* on this origin.
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5030').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Proxy the API through this origin so auth cookies are first-party (no cross-site cookie
  // issues on Vercel/VPS). Only /api/v1/* is proxied — /api/revalidate etc. stay Next routes.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${BACKEND_URL}/api/v1/:path*` }];
  },

  // Images: backend media are already WebP variants (rendered `unoptimized`) and stock
  // placeholders use the Unsplash/Pexels CDN loader — the Next optimizer is not involved.
  // The patterns stay as a safety net for any plain <Image> pointing at these hosts.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/photos/**' },
    ],
  },

  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
