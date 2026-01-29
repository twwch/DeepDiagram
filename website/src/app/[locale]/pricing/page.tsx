import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Check, Github } from 'lucide-react';
import { createMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return createMetadata({
    title: locale === 'zh' ? '定价' : 'Pricing',
    description: locale === 'zh' ? '开源免费，也提供托管服务' : 'Open source and free, with hosted services available',
    locale,
    path: '/pricing',
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PricingContent />;
}

function PricingContent() {
  const t = useTranslations('pricing');

  const freeFeatures: string[] = t.raw('free.features');
  const proFeatures: string[] = t.raw('pro.features');

  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center py-20">
      <div className="w-full px-6 sm:px-12 lg:px-20 xl:px-32">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* Free tier */}
          <div className="rounded-2xl border-2 border-primary-600 bg-white p-10 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900">{t('free.name')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('free.desc')}</p>
            <div className="mt-6">
              <span className="text-4xl font-bold text-gray-900">{t('free.price')}</span>
            </div>
            <Button href="https://github.com/twwch/DeepDiagram" external size="lg" className="mt-6 w-full">
              <Github className="h-4 w-4" />
              {t('free.name')}
            </Button>
            <ul className="mt-8 space-y-3">
              {freeFeatures.map((feature: string) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div className="rounded-2xl border border-gray-200 bg-white p-10">
            <h3 className="text-xl font-semibold text-gray-900">{t('pro.name')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('pro.desc')}</p>
            <div className="mt-6">
              <span className="text-4xl font-bold text-gray-900">{t('pro.price')}</span>
            </div>
            <Button variant="secondary" size="lg" className="mt-6 w-full cursor-not-allowed opacity-60">
              {t('pro.price')}
            </Button>
            <ul className="mt-8 space-y-3">
              {proFeatures.map((feature: string) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
