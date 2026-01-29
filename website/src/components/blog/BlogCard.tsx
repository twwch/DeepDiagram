import { Link } from '@/lib/i18n/navigation';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { Clock, ArrowRight } from 'lucide-react';
import { getFirstContentImage } from '@/lib/mdx/content';
import type { BlogPost } from '@/lib/mdx/types';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const { slug, locale, frontmatter, readingTime } = post;
  const coverImage = frontmatter.image || getFirstContentImage(post.content);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-100/50">
      <Link href={`/blog/${slug}`} className="flex flex-1 flex-col">
        {/* Cover */}
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt={frontmatter.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl" />
              <div className="absolute right-1/4 top-1/3 h-2 w-2 rounded-full bg-blue-400/60" />
              <div className="absolute bottom-1/4 left-1/3 h-1.5 w-1.5 rounded-full bg-indigo-400/60" />
              <span className="relative z-10 bg-gradient-to-r from-blue-300 via-blue-100 to-indigo-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent select-none sm:text-5xl">
                {frontmatter.title.split(/[\s:：]+/)[0]}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-3">
            <Badge>{frontmatter.category}</Badge>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {readingTime} {locale === 'zh' ? '分钟' : 'min'}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary-600">
            {frontmatter.title}
          </h3>

          <p className="mt-2 flex-1 line-clamp-2 text-sm leading-relaxed text-gray-500">
            {frontmatter.description}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-400">
              {formatDate(frontmatter.date, locale)}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
              {locale === 'zh' ? '阅读' : 'Read'}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
