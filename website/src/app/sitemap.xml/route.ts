import { getAllPosts, getAllDocs } from '@/lib/mdx/content';

const SITE_URL = 'https://deepd.cturing.cn';

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function GET() {
  const locales = ['zh', 'en'];
  const staticPages = ['', '/features', '/pricing', '/about', '/blog', '/docs', '/changelog'];

  const urls: string[] = [];

  // Static pages with hreflang alternates
  for (const locale of locales) {
    for (const page of staticPages) {
      const loc = `${SITE_URL}/${locale}${page}`;
      const priority = page === '' ? '1.0' : '0.8';
      urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${formatDate(new Date())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`);
    }
  }

  // Blog posts
  for (const locale of locales) {
    const posts = getAllPosts(locale);
    for (const post of posts) {
      const loc = `${SITE_URL}/${locale}/blog/${post.slug}`;
      urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${formatDate(new Date(post.frontmatter.date))}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }
  }

  // Doc pages
  for (const locale of locales) {
    const posts = getAllDocs(locale);
    for (const post of posts) {
      const loc = `${SITE_URL}/${locale}/docs/${post.slug}`;
      urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${formatDate(new Date())}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
