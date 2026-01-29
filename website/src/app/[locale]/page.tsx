import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/home/Hero';
import { FeatureGrid } from '@/components/home/FeatureGrid';
import { HowItWorks } from '@/components/home/HowItWorks';
import { OpenSource } from '@/components/home/OpenSource';
import { CTABanner } from '@/components/home/CTABanner';
import { JsonLd } from '@/components/seo/JsonLd';
import { websiteJsonLd, organizationJsonLd, softwareJsonLd } from '@/lib/seo/jsonld';
import { createMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const title = locale === 'zh' ? 'DeepDiagram AI - 智能图表生成平台' : 'DeepDiagram AI - Intelligent Diagram Generator';
  const description = locale === 'zh'
    ? '开源 AI 可视化平台，用自然语言生成专业思维导图、流程图、数据图表和架构图。'
    : 'Open source AI visualization platform. Generate professional mind maps, flowcharts, data charts, and architecture diagrams with natural language.';
  return createMetadata({ title, description, locale });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={softwareJsonLd()} />
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <OpenSource />
      <CTABanner />
    </>
  );
}
