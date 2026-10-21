import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. Next.js inline bootstrap scripts require
 * 'unsafe-inline' unless nonce-based CSP is used (which forces dynamic rendering).
 * Third parties are limited to Supabase, Razorpay Checkout and (optional) GA4.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://*.razorpay.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl} https://*.razorpay.com https://www.googletagmanager.com https://*.google-analytics.com`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^https/, "wss")} https://*.razorpay.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .join("; ")
  .replace(/\s{2,}/g, " ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self \"https://checkout.razorpay.com\")" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Admin image uploads go through Server Actions (default limit 1 MB).
    // Kept under Vercel's 4.5 MB request-body cap; images themselves max 4 MB.
    serverActions: { bodySizeLimit: "4.4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/media/**`)] : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(account|admin)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
