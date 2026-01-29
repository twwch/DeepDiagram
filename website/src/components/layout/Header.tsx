'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Menu, X, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/features', key: 'features' },
  { href: '/pricing', key: 'pricing' },
  { href: '/blog', key: 'blog' },
  { href: '/docs', key: 'docs' },
  { href: '/about', key: 'about' },
] as const;

export function Header() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-lg">
      <Container>
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="DeepDiagram" className="h-8 w-8 rounded-lg" width={32} height={32} />
            <span className="text-lg font-semibold text-gray-900">DeepDiagram</span>
          </Link>

          {/* Desktop Nav */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 md:flex">
            <LocaleSwitcher />
            <Button href="https://github.com/twwch/DeepDiagram" external variant="ghost" size="sm">
              <Github className="h-4 w-4" />
              {tc('viewOnGitHub')}
            </Button>
            <Button href="https://deepd.cturing.cn/app" external size="sm">
              {tc('tryItFree')}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        <div className={cn('overflow-hidden transition-all duration-300 md:hidden', mobileOpen ? 'max-h-96 pb-4' : 'max-h-0')}>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
              <LocaleSwitcher />
              <Button href="https://deepd.cturing.cn/app" external size="sm" className="flex-1">
                {tc('tryItFree')}
              </Button>
            </div>
          </nav>
        </div>
      </Container>
    </header>
  );
}
