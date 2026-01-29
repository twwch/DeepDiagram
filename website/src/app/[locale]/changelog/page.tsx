import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Section } from '@/components/ui/Section';
import { createMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return createMetadata({
    title: locale === 'zh' ? '更新日志' : 'Changelog',
    description: locale === 'zh' ? 'DeepDiagram 版本更新记录' : 'DeepDiagram version history',
    locale,
    path: '/changelog',
  });
}

const releases = [
  {
    version: 'v0.1.27',
    date: '2025-01-15',
    zh: ['六大 AI 智能体：思维导图、流程图、数据图表、架构图、Mermaid、信息图', 'LangGraph 多智能体架构', 'Docker 一键部署', '实时流式生成', 'PNG/SVG 导出'],
    en: ['Six AI agents: Mind Map, Flowchart, Charts, Draw.io, Mermaid, Infographic', 'LangGraph multi-agent architecture', 'One-click Docker deployment', 'Real-time streaming generation', 'PNG/SVG export'],
  },
];

export default async function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ChangelogContent locale={locale} />;
}

function ChangelogContent({ locale }: { locale: string }) {
  const t = useTranslations('changelog');

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>

        <div className="mt-16 space-y-12">
          {releases.map((release) => (
            <div key={release.version} className="relative border-l-2 border-primary-200 pl-8">
              <div className="absolute -left-2.5 top-0 h-5 w-5 rounded-full border-2 border-primary-600 bg-white" />
              <h2 className="text-xl font-bold text-gray-900">{release.version}</h2>
              <p className="mt-1 text-sm text-gray-500">{release.date}</p>
              <ul className="mt-4 space-y-2">
                {(locale === 'zh' ? release.zh : release.en).map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
