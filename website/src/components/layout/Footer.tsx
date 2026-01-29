import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { Github } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');

  const productLinks = [
    { href: '/features', label: tn('features') },
    { href: '/pricing', label: tn('pricing') },
    { href: '/changelog', label: tn('changelog') },
  ];

  const resourceLinks = [
    { href: '/blog', label: tn('blog') },
    { href: '/docs', label: tn('docs') },
  ];

  const companyLinks = [
    { href: '/about', label: tn('about') },
  ];

  return (
    <footer aria-label="Site footer" className="border-t border-gray-200 bg-gray-50">
      <Container className="py-12 sm:py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="DeepDiagram" className="h-8 w-8 rounded-lg" width={32} height={32} />
              <span className="text-lg font-semibold text-gray-900">DeepDiagram</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {t('description')}
            </p>
            <a
              href="https://github.com/twwch/DeepDiagram"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('product')}</h3>
            <ul className="mt-4 space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-700">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('resources')}</h3>
            <ul className="mt-4 space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-700">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('company')}</h3>
            <ul className="mt-4 space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-700">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-center text-sm text-gray-400">{t('copyright')}</p>
        </div>
      </Container>
    </footer>
  );
}
