import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { JsonLd } from '@/components/seo/JsonLd';
import { getAllPosts, getPostBySlug, getFirstContentImage } from '@/lib/mdx/content';
import { blogPostJsonLd } from '@/lib/seo/jsonld';
import { createMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/utils';
import { locales } from '@/lib/i18n/config';
import { ArrowLeft, Clock } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    const posts = getAllPosts(locale);
    for (const post of posts) {
      params.push({ locale, slug: post.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const post = getPostBySlug(slug, locale);
  if (!post) return {};
  return createMetadata({
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    locale,
    path: `/blog/${slug}`,
    image: post.frontmatter.image,
    category: post.frontmatter.category,
    date: post.frontmatter.date,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = getPostBySlug(slug, locale);
  if (!post) notFound();

  return (
    <>
      <JsonLd data={blogPostJsonLd(post)} />
      <article>
        {/* Hero header */}
        <div className="border-b border-gray-100 bg-gradient-to-b from-primary-50/40 to-white pb-12 pt-16 sm:pb-16 sm:pt-20">
          <Container className="max-w-4xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-primary-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {locale === 'zh' ? '返回博客' : 'Back to Blog'}
            </Link>

            <header className="mt-8">
              <div className="flex items-center gap-3">
                <Badge>{post.frontmatter.category}</Badge>
                <span className="flex items-center gap-1 text-sm text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {post.readingTime} {locale === 'zh' ? '分钟阅读' : 'min read'}
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
                {post.frontmatter.title}
              </h1>
              <p className="mt-4 text-lg text-gray-500">
                {post.frontmatter.description}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {post.frontmatter.author.charAt(0)}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{post.frontmatter.author}</div>
                  <time className="text-gray-400">{formatDate(post.frontmatter.date, locale)}</time>
                </div>
              </div>
            </header>

            {/* Cover image */}
            {(() => {
              const coverImage = post.frontmatter.image || getFirstContentImage(post.content);
              return (
                <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-2xl shadow-lg">
                  {coverImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={coverImage}
                      alt={post.frontmatter.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-10">
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
                      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
                      <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
                      <div className="absolute left-1/2 top-1/4 h-32 w-32 -translate-x-1/2 rounded-full bg-purple-500/10 blur-2xl" />
                      <div className="absolute right-1/4 top-1/3 h-2 w-2 rounded-full bg-blue-400/60" />
                      <div className="absolute bottom-1/4 left-1/3 h-1.5 w-1.5 rounded-full bg-indigo-400/60" />
                      <div className="absolute bottom-1/3 right-1/3 h-1 w-1 rounded-full bg-purple-400/60" />
                      <div className="absolute right-[15%] top-[20%] h-16 w-16 rounded-full border border-blue-400/20" />
                      <div className="absolute bottom-[15%] left-[10%] h-24 w-24 rounded-full border border-indigo-400/10" />
                      <span className="relative z-10 bg-gradient-to-r from-blue-300 via-blue-100 to-indigo-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent select-none sm:text-6xl md:text-7xl">
                        {post.frontmatter.title.split(/[\s:：]+/)[0]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </Container>
        </div>

        {/* Article body */}
        <div className="py-12 sm:py-16">
          <Container className="max-w-4xl">
            <div className="prose max-w-none">
              <MDXRemote
                source={post.content}
                options={{
                  mdxOptions: {
                    remarkPlugins: [remarkGfm],
                    rehypePlugins: [rehypeSlug],
                  },
                }}
              />
            </div>
          </Container>
        </div>
      </article>
    </>
  );
}
