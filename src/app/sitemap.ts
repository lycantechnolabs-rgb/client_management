import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

/**
 * The public pages, for a crawler.
 *
 * Product pages come from the database rather than a list kept by hand, so
 * adding a cardamom grade in the admin puts it in the sitemap without anyone
 * remembering to. Only active products are listed: advertising one that has
 * been withdrawn earns a 404 from every crawler that follows it.
 *
 * `lastModified` is real where we have it — a product's own updatedAt — because
 * a date that is always "today" tells a crawler nothing and is quietly ignored.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/store`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/services`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/quality`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/gallery`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/orders/lookup`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    products = await db.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    });
  } catch {
    // A sitemap missing its product pages is a smaller problem than a sitemap
    // that fails to build, which takes the whole route down.
  }

  return [
    ...pages,
    ...products.map((p) => ({
      url: `${base}/store/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
