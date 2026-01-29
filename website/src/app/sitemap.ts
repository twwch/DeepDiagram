import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/mdx/content';

const SITE_URL = 'https://deepd.cturing.cn';

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['zh', 'en'];
  const staticPages = ['', '/features', '/pricing', '/about', '/blog', '/docs', '/changelog'];

  const staticEntries = locales.flatMap((locale) =>
    staticPages.map((page) => ({
      url: `${SITE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1.0 : 0.8,
      alternates: {
        languages: {
          zh: `${SITE_URL}/zh${page}`,
          en: `${SITE_URL}/en${page}`,
        },
      },
    }))
  );

  const blogEntries = locales.flatMap((locale) =>
    getAllPosts(locale).map((post) => ({
      url: `${SITE_URL}/${locale}/blog/${post.slug}`,
      lastModified: new Date(post.frontmatter.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  );

  return [...staticEntries, ...blogEntries];
}
