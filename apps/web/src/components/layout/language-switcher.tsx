'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Globe } from 'lucide-react';

const LOCALES: Array<{ code: 'fr' | 'ar' | 'en'; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
];

export function LanguageSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as 'fr' | 'ar' | 'en';
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="relative inline-flex items-center">
      <label htmlFor="language-select" className="sr-only">
        {t('switchLanguage')}
      </label>
      <Globe className="w-4 h-4 text-slate-500 pointer-events-none absolute start-3" aria-hidden="true" />
      <select
        id="language-select"
        value={currentLocale}
        onChange={handleChange}
        aria-label={t('switchLanguage')}
        className="h-[44px] ps-9 pe-8 py-2 text-sm font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
      >
        {LOCALES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
