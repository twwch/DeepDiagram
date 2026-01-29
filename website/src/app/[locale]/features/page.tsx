import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Section } from '@/components/ui/Section';
import { Brain, GitBranch, BarChart3, Cpu, Share2, Image as ImageIcon } from 'lucide-react';
import { createMetadata } from '@/lib/seo/metadata';
import NextImage from 'next/image';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return createMetadata({
    title: locale === 'zh' ? '功能特性' : 'Features',
    description: locale === 'zh' ? '探索 DeepDiagram 六大 AI 智能体的强大功能' : 'Explore the powerful capabilities of DeepDiagram\'s six AI agents',
    locale,
    path: '/features',
  });
}

const agents = [
  { key: 'mindmap', icon: Brain, color: 'from-purple-500 to-purple-600', image: '/images/features/mindmap.png', width: 2980, height: 1654 },
  { key: 'flowchart', icon: GitBranch, color: 'from-blue-500 to-blue-600', image: '/images/features/flow.png', width: 2944, height: 1638 },
  { key: 'chart', icon: BarChart3, color: 'from-green-500 to-green-600', video: '/images/features/chart.mp4', width: 960, height: 466 },
  { key: 'drawio', icon: Cpu, color: 'from-orange-500 to-orange-600', image: '/images/features/draw.png', width: 2966, height: 1650 },
  { key: 'mermaid', icon: Share2, color: 'from-cyan-500 to-cyan-600', image: '/images/features/mermaid.png', width: 2968, height: 1630 },
  { key: 'infographic', icon: ImageIcon, color: 'from-pink-500 to-pink-600', video: '/images/features/infographic.mp4', width: 960, height: 530 },
] as const;

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FeaturesContent />;
}

function FeaturesContent() {
  const t = useTranslations('features');

  return (
    <>
      <Section>
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t('sectionTitle')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            {t('sectionSubtitle')}
          </p>
        </div>

        <div className="mt-20 space-y-20">
          {agents.map((agent, i) => {
            const Icon = agent.icon;
            const isReversed = i % 2 === 1;
            return (
              <div
                key={agent.key}
                className={`flex flex-col items-center gap-12 lg:flex-row ${isReversed ? 'lg:flex-row-reverse' : ''}`}
              >
                <div className="flex-1">
                  <div className={`inline-flex rounded-xl bg-gradient-to-br ${agent.color} p-3 text-white shadow-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-gray-900">
                    {t(`${agent.key}.title`)}
                  </h3>
                  <p className="mt-3 text-lg leading-relaxed text-gray-600">
                    {t(`${agent.key}.desc`)}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                    {'video' in agent ? (
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        width={agent.width}
                        height={agent.height}
                        className="w-full object-cover"
                      >
                        <source src={agent.video} type="video/mp4" />
                      </video>
                    ) : (
                      <NextImage
                        src={agent.image}
                        alt={t(`${agent.key}.title`)}
                        width={agent.width}
                        height={agent.height}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="w-full object-cover"
                        loading={i < 2 ? 'eager' : 'lazy'}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
