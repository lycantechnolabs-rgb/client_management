/**
 * The site's own address.
 *
 * Needed by robots.txt and the sitemap, which have to emit absolute URLs — a
 * relative one there is simply ignored by a crawler.
 *
 * The domain is still pending (see the README), so this reads the environment
 * and falls back to localhost rather than hard-coding a guess. Getting it wrong
 * is not harmless: a sitemap listing the wrong host advertises pages that do
 * not exist, and a crawler will believe it.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the project's production domain
 * — the stable one, not the per-deployment URL, which is what a sitemap needs.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
