import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Section } from '@/components/ui/Section';
import { BlogCard } from '@/components/blog/BlogCard';
import { getAllPosts } from '@/lib/mdx/content';
import { createMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return createMetadata({
    title: locale === 'zh' ? '博客' : 'Blog',
    description: locale === 'zh' ? '产品动态、技术分享与最佳实践' : 'Product updates, technical insights, and best practices',
    locale,
    path: '/blog',
  });
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = getAllPosts(locale);

  return <BlogContent posts={posts} locale={locale} />;
}

function BlogContent({ posts, locale }: { posts: any[]; locale: string }) {
  const t = useTranslations('blog');

  return (
    <Section>
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>
      </div>

      {posts.length === 0 ? (
        <p className="mt-16 text-center text-gray-500">{t('noPosts')}</p>
      ) : (
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </Section>
  );
}
