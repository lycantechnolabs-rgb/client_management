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
  experimental: {
    /**
     * Uploads travel inside a Server Action's request body, and the default
     * ceiling on that body is 1 MB — small enough that every photograph taken
     * on a phone was rejected before any of our code ran, with a runtime error
     * page rather than a message the grower could act on.
     *
     * 4 MB, not more, and deliberately: Vercel's serverless platform caps a
     * request body at 4.5 MB regardless of what is configured here, so a larger
     * number would work locally and fail in production — the worst kind of
     * setting. Photographs are compressed in the browser before they are sent
     * (src/lib/compress-image.ts), so this is headroom rather than the everyday
     * path. Anything genuinely large needs direct-to-storage uploads.
     */
    serverActions: { bodySizeLimit: "4mb" },

    /**
     * Every admin/dashboard page reads the session, so Next treats all of
     * them as "dynamic" — and a dynamic route with no `loading.js` boundary
     * is not prefetched at all (see the admin/ and dashboard/ loading.tsx
     * files, added alongside this). Even with that boundary, the default
     * `dynamic` stale time is 0: revisiting a tab within the same few
     * seconds still pays a full server round trip. 30 seconds means a quick
     * Home → Workers → Home stays instant; a server action's own
     * `revalidatePath` still busts this immediately; so editing something
     * and coming back to look at it is never stale.
     */
    staleTimes: { dynamic: 30 },
  },

  /**
   * Image formats, in the order they are offered.
   *
   * Next negotiates against the browser's Accept header and serves the first
   * format it says it can take, so listing AVIF first costs nothing on a
   * browser that cannot read it — that one gets WebP, and something ancient
   * gets JPEG. AVIF is typically 20–30% smaller than WebP at the same quality,
   * which is the difference that matters here: the growers read this on phones
   * on hill connections, and the store's photographs are the heaviest thing on
   * the site.
   *
   * The cost is encode time on a cache miss, paid once per size per format and
   * then cached — which is why the cache below is set to a year rather than
   * left at the 60-second default, where a cold encode would be repaid over and
   * over for the same image.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },

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
        // Thumbnails of a grower's own photographs. Same ownership check as
        // /api/files, but these may sit in the viewer's own browser cache —
        // `private` keeps them out of any shared one. The Cache-Control is
        // deliberately absent here so the route's own value survives; a rule
        // set at this level overwrites what the handler returns, which is why
        // /api/files above has to declare its no-store here rather than there.
        source: "/api/thumb/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
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
