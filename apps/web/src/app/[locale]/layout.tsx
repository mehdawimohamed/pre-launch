import { notFound } from 'next/navigation';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Noto_Sans_Arabic } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/layout/header';
import '../globals.css';

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as 'fr' | 'ar' | 'en')) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client side
  const messages = await getMessages();

  // App shell stays strictly LTR as per spec ("The app shell stays LTR").
  // Arabic content renders inside using dir="auto" and <bdi> helpers.
  return (
    <html lang={locale} dir="ltr" className={notoSansArabic.variable}>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              <p>© {new Date().getFullYear()} Tawassol. Test de marché — Aucune transaction financière réelle.</p>
            </footer>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
