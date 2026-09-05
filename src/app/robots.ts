import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/**
 * What a crawler may look at.
 *
 * The public site should be found; nothing behind a login should be listed.
 * The portal and admin are already unreachable without a session, so this is
 * not a security measure — it stops a crawler wasting its budget on redirects,
 * and stops a sign-in page turning up in search results for the business name.
 *
 * `/api` is excluded for the same reason: those paths answer to the app, not to
 * a reader.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api", "/login", "/portal-entry", "/checkout", "/cart"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
