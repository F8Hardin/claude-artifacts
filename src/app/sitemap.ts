import type { MetadataRoute } from "next";
import { fetchPublicArtifactsForSitemap } from "@/lib/supabase/artifacts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const artifacts = await fetchPublicArtifactsForSitemap();

  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    ...artifacts.map((a) => ({
      url: `${siteUrl}/artifact/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
