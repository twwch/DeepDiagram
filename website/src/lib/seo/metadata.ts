import type { Metadata } from 'next';

const SITE_URL = 'https://deepd.cturing.cn';
const SITE_NAME = 'DeepDiagram AI';

export function createMetadata({
  title,
  description,
  locale,
  path = '',
  image,
  category,
  date,
}: {
  title: string;
  description: string;
  locale: string;
  path?: string;
  image?: string;
  category?: string;
  date?: string;
}): Metadata {
  const url = `${SITE_URL}/${locale}${path}`;
  const ogParams = new URLSearchParams({ title, locale });
  if (category) ogParams.set('category', category);
  if (date) ogParams.set('date', date);
  const ogImage = image || `${SITE_URL}/api/og?${ogParams.toString()}`;
  const fullTitle = path ? `${title} | ${SITE_NAME}` : title;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
      languages: {
        zh: `${SITE_URL}/zh${path}`,
        en: `${SITE_URL}/en${path}`,
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}
