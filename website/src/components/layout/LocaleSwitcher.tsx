'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div role="group" aria-label="Language switcher" className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
      <button
        onClick={() => switchLocale('zh')}
        aria-label="Switch to Chinese"
        aria-pressed={locale === 'zh'}
        className={cn(
          'rounded-md px-2.5 py-1 transition-colors',
          locale === 'zh' ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        )}
      >
        ZH
      </button>
      <button
        onClick={() => switchLocale('en')}
        aria-label="Switch to English"
        aria-pressed={locale === 'en'}
        className={cn(
          'rounded-md px-2.5 py-1 transition-colors',
          locale === 'en' ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        )}
      >
        EN
      </button>
    </div>
  );
}
