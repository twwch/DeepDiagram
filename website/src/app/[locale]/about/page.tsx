import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Github, Layers, Cpu, Database, Container as ContainerIcon } from 'lucide-react';
import { createMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return createMetadata({
    title: locale === 'zh' ? '关于我们' : 'About',
    description: locale === 'zh' ? '了解 DeepDiagram 的使命和技术' : 'Learn about DeepDiagram\'s mission and technology',
    locale,
    path: '/about',
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutContent />;
}

function AboutContent() {
  const t = useTranslations('about');

  const techStack = [
    { icon: Layers, name: 'LangGraph', desc: 'Multi-agent orchestration' },
    { icon: Cpu, name: 'React + TypeScript', desc: 'Frontend framework' },
    { icon: Database, name: 'FastAPI + PostgreSQL', desc: 'Backend API & database' },
    { icon: ContainerIcon, name: 'Docker', desc: 'Containerized deployment' },
  ];

  return (
    <>
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>
          <p className="mt-8 text-base leading-relaxed text-gray-600">{t('mission')}</p>
        </div>
      </Section>

      <Section className="bg-gray-50">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">{t('techTitle')}</h2>
          <p className="mt-4 text-lg text-gray-600">{t('techDesc')}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {techStack.map((tech) => {
            const Icon = tech.icon;
            return (
              <div key={tech.name} className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <Icon className="mx-auto h-8 w-8 text-primary-600" />
                <h3 className="mt-3 font-semibold text-gray-900">{tech.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{tech.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <Button href="https://github.com/twwch/DeepDiagram" external variant="secondary" size="lg">
            <Github className="h-4 w-4" />
            View on GitHub
          </Button>
        </div>
      </Section>
    </>
  );
}
