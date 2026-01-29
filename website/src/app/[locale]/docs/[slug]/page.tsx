import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { getAllDocs, getDocBySlug } from '@/lib/mdx/content';
import { createMetadata } from '@/lib/seo/metadata';
import { locales } from '@/lib/i18n/config';
import { ArrowLeft } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    const docs = getAllDocs(locale);
    for (const doc of docs) {
      params.push({ locale, slug: doc.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const doc = getDocBySlug(slug, locale);
  if (!doc) return {};
  return createMetadata({
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    locale,
    path: `/docs/${slug}`,
  });
}

export default async function DocPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const doc = getDocBySlug(slug, locale);
  if (!doc) notFound();

  return (
    <article className="py-16 sm:py-20">
      <Container className="max-w-4xl">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-primary-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {locale === 'zh' ? '返回文档' : 'Back to Docs'}
        </Link>

        <header className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {doc.frontmatter.title}
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            {doc.frontmatter.description}
          </p>
        </header>

        <div className="prose mt-12 max-w-none">
          <MDXRemote
            source={doc.content}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [rehypeSlug],
              },
            }}
          />
        </div>
      </Container>
    </article>
  );
}
