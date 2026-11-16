import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { UserText, IsolatedText } from '@/components/ui/user-text';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <HomePageContent params={params} />;
}

async function HomePageContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeView />;
}

function HomeView() {
  const t = useTranslations('hero');
  const commonT = useTranslations('common');

  // Sample mixed-script user content to demonstrate dir="auto" and <bdi> isolation
  const sampleCampaigns = [
    {
      id: '1',
      title: 'مشروع زيت الزيتون البيولوجي التونسي',
      creator: 'أحمد التونسي',
      pitch: 'إنتاج وتوزيع أفضل زيت زيتون شملالي بيولوجي من سهول القيروان إلى الأسواق العالمية.',
      goal: '25,000 TND',
    },
    {
      id: '2',
      title: 'Artisanat Moderne de Nabeul',
      creator: 'Sarra Ben Mahmoud',
      pitch: 'Création d’objets de céramique contemporaine valorisant le patrimoine artisanal tunisien.',
      goal: '15,000 TND',
    },
    {
      id: '3',
      title: 'BioTech Agri-Sensor for Medenine Farms',
      creator: 'Dr. Youssef Trabelsi',
      pitch: 'Low-cost IoT soil moisture probes built specifically for arid agriculture in southern Tunisia.',
      goal: '40,000 TND',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 sm:py-16 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-6 border border-emerald-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{commonT('tagline')}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          {t('title')}
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {t('subtitle')}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="primary" size="lg" className="w-full sm:w-auto">
            {t('ctaExplore')}
            <ArrowRight className="w-4 h-4 ms-2" />
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto">
            {t('ctaStart')}
          </Button>
        </div>
      </section>

      {/* Featured Demonstrations (Testing dir="auto" and <bdi>) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {localeSectionTitle()}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sampleCampaigns.map((camp) => (
            <div
              key={camp.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  Objectif: {camp.goal}
                </div>

                {/* Campaign title with <bdi> isolation and dir="auto" */}
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  <UserText as="span">
                    <IsolatedText>{camp.title}</IsolatedText>
                  </UserText>
                </h3>

                {/* User-generated pitch with dir="auto" */}
                <UserText className="text-sm text-slate-600">
                  {camp.pitch}
                </UserText>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Par: <IsolatedText className="font-medium text-slate-700">{camp.creator}</IsolatedText></span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Test actif
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function localeSectionTitle() {
  return 'Projets récemment soumis (Test de marché)';
}
