import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { Section } from '@/components/ui/Section';
import { createMetadata } from '@/lib/seo/metadata';
import { BookOpen, Rocket, Server } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return createMetadata({
    title: locale === 'zh' ? '文档' : 'Documentation',
    description: locale === 'zh' ? 'DeepDiagram 使用文档和部署指南' : 'DeepDiagram documentation and deployment guide',
    locale,
    path: '/docs',
  });
}

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cards = [
    {
      icon: Rocket,
      title: locale === 'zh' ? '快速开始' : 'Getting Started',
      desc: locale === 'zh' ? '5 分钟内启动 DeepDiagram' : 'Get DeepDiagram running in 5 minutes',
      href: '/docs/getting-started',
    },
    {
      icon: Server,
      title: locale === 'zh' ? '部署指南' : 'Deployment',
      desc: locale === 'zh' ? 'Docker 部署和配置指南' : 'Docker deployment and configuration guide',
      href: '/docs/deployment',
    },
    {
      icon: BookOpen,
      title: locale === 'zh' ? 'API 参考' : 'API Reference',
      desc: locale === 'zh' ? '后端 API 接口文档' : 'Backend API documentation',
      href: '/docs/api-reference',
    },
  ];

  return (
    <Section>
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {locale === 'zh' ? '文档' : 'Documentation'}
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          {locale === 'zh' ? '学习如何使用和部署 DeepDiagram' : 'Learn how to use and deploy DeepDiagram'}
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="block rounded-xl border border-gray-200 p-6 transition-shadow hover:shadow-md">
              <Icon className="h-8 w-8 text-primary-600" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{card.desc}</p>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
