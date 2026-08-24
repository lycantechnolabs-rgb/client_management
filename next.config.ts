import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * The CSP allows 'unsafe-inline' for styles because Tailwind and next/font
 * inject inline style tags. Scripts allow 'unsafe-inline' only because Next's
 * hydration bootstrap is inline; tightening that needs nonce plumbing through
 * a middleware, which is the right next step before production.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" +
    (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'" +
    (process.env.NODE_ENV === "development" ? " ws: http:" : ""),
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // Client attachments, served only after the route checks ownership.
        // Headers set inside a route handler are overwritten by this config,
        // so the sandbox has to be declared here to actually take effect.
        source: "/api/files/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Content-Security-Policy", value: "sandbox; default-src 'none'" },
        ],
      },
      {
        // Public store imagery. Still user-supplied bytes at heart, so the
        // same sandbox applies — a crafted file must not script this origin.
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Disposition", value: "inline" },
          { key: "Content-Security-Policy", value: "sandbox; default-src 'none'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // The shop moved from /products to /store when the site was refocused
      // on estate management. Keep old links working.
      { source: "/products", destination: "/store", permanent: true },
      { source: "/products/:slug", destination: "/store/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
