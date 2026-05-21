import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/",         changeFrequency: "weekly",  priority: 1.0 },
    { path: "/about",    changeFrequency: "monthly", priority: 0.8 },
    { path: "/blog",     changeFrequency: "weekly",  priority: 0.8 },
    { path: "/guides",   changeFrequency: "weekly",  priority: 0.8 },
    { path: "/faq",      changeFrequency: "monthly", priority: 0.7 },
    { path: "/contact",  changeFrequency: "yearly",  priority: 0.6 },
    { path: "/careers",  changeFrequency: "weekly",  priority: 0.6 },
    { path: "/press",    changeFrequency: "monthly", priority: 0.5 },
    { path: "/crisis",   changeFrequency: "yearly",  priority: 0.9 },
    { path: "/privacy",  changeFrequency: "yearly",  priority: 0.3 },
    { path: "/terms",    changeFrequency: "yearly",  priority: 0.3 },
    { path: "/cookies",  changeFrequency: "yearly",  priority: 0.3 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
