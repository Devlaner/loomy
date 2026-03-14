import { Link } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useInView } from "@/hooks/useInView";

function FadeSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { ref, inView } = useInView();
  return (
    <section
      ref={ref}
      id={id}
      className={`transition-opacity duration-[150ms] ease-out ${inView ? "opacity-100" : "opacity-0"} ${className}`}
    >
      {children}
    </section>
  );
}

export function LandingPage() {
  const { t } = useI18n();
  const { token } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle />
      <Header showAuth={!token} showDashboard={!!token} />

      <main className="flex-1">
        {/* Hero — do not touch */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[var(--text-primary)] leading-tight tracking-tight">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            {token ? (
              <Link to="/dashboard">
                <Button size="lg">{t("dashboard.title")}</Button>
              </Link>
            ) : (
              <Link to="/register">
                <Button size="lg">{t("landing.hero.cta")}</Button>
              </Link>
            )}
            <Link to="/login">
              <Button variant="outline" size="lg">
                {t("landing.hero.secondary")}
              </Button>
            </Link>
          </div>
        </section>

        <FadeSection
          className="max-w-4xl mx-auto px-4 sm:px-6 py-20 border-t border-[var(--border)]"
          id="how-it-works"
        >
          <h2 className="text-xl font-semibold text-[var(--text-primary)] text-center mb-12">
            {t("landing.howItWorks.title")}
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 sm:gap-6">
            <div className="flex flex-col sm:items-center sm:text-center sm:flex-1">
              <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full border-2 border-[var(--border)] bg-[var(--bg-primary)] text-sm font-semibold text-[var(--text-primary)]">
                1
              </span>
              <p className="mt-4 text-[var(--text-secondary)] text-sm leading-relaxed sm:mt-3">
                {t("landing.howItWorks.step1")}
              </p>
            </div>
            <div className="flex flex-col sm:items-center sm:text-center sm:flex-1">
              <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full border-2 border-[var(--border)] bg-[var(--bg-primary)] text-sm font-semibold text-[var(--text-primary)]">
                2
              </span>
              <p className="mt-4 text-[var(--text-secondary)] text-sm leading-relaxed sm:mt-3">
                {t("landing.howItWorks.step2")}
              </p>
            </div>
            <div className="flex flex-col sm:items-center sm:text-center sm:flex-1">
              <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full border-2 border-[var(--border)] bg-[var(--bg-primary)] text-sm font-semibold text-[var(--text-primary)]">
                3
              </span>
              <p className="mt-4 text-[var(--text-secondary)] text-sm leading-relaxed sm:mt-3">
                {t("landing.howItWorks.step3")}
              </p>
            </div>
          </div>
        </FadeSection>

        <FadeSection className="max-w-4xl mx-auto px-4 sm:px-6 py-20 border-t border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-8">
            {t("landing.capabilities.title")}
          </h2>
          <dl className="grid sm:grid-cols-2 gap-8 sm:gap-6">
            <div>
              <dt className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {t("landing.capabilities.organizeLabel")}
              </dt>
              <dd className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("landing.capabilities.organizeDesc")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {t("landing.capabilities.collaborateLabel")}
              </dt>
              <dd className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("landing.capabilities.collaborateDesc")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {t("landing.capabilities.createLabel")}
              </dt>
              <dd className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("landing.capabilities.createDesc")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {t("landing.capabilities.openSourceLabel")}
              </dt>
              <dd className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("landing.capabilities.openSourceDesc")}
              </dd>
            </div>
          </dl>
        </FadeSection>

        <FadeSection className="max-w-4xl mx-auto px-4 sm:px-6 py-20 border-t border-[var(--border)]">
          <div className="text-center">
            <p className="text-[var(--text-primary)] font-medium text-lg mb-4">
              {t("landing.cta.title")}
            </p>
            {token ? (
              <Link to="/dashboard">
                <Button size="lg">{t("dashboard.title")}</Button>
              </Link>
            ) : (
              <Link to="/register">
                <Button size="lg">{t("landing.cta.button")}</Button>
              </Link>
            )}
          </div>
        </FadeSection>

        <footer className="border-t border-[var(--border)] py-8 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center text-[var(--text-muted)] text-sm">
            {t("landing.footer.tagline")}
          </div>
        </footer>
      </main>
    </div>
  );
}
