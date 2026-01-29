import type { BlogPost } from '../mdx/types';

const SITE_URL = 'https://deepd.cturing.cn';

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DeepDiagram AI',
    url: SITE_URL,
    description: 'AI-powered intelligent visualization platform',
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DeepDiagram',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    sameAs: ['https://github.com/chen-yingfa/DeepDiagram'],
  };
}

export function blogPostJsonLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.frontmatter.title,
    description: post.frontmatter.description,
    image: post.frontmatter.image,
    datePublished: post.frontmatter.date,
    author: {
      '@type': 'Organization',
      name: 'DeepDiagram Team',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DeepDiagram AI',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/logo.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/${post.locale}/blog/${post.slug}`,
    },
    inLanguage: post.locale === 'zh' ? 'zh-CN' : 'en',
  };
}

export function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DeepDiagram',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'AI-powered diagram generation platform with six specialized agents',
  };
}
