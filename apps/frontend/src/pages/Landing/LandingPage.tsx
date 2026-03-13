import { Link } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";

export function LandingPage() {
  const { t } = useI18n();
  const { token } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle />
      <Header showAuth={!token} showDashboard={!!token} />

      <main className="flex-1">
        {/* Hero */}
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

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] text-center mb-12">
            {t("landing.features.title")}
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent-soft)] flex items-center justify-center text-2xl mb-4">
                📋
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t("landing.features.boards")}
              </h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                {t("landing.features.boardsDesc")}
              </p>
            </div>
            <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent-soft)] flex items-center justify-center text-2xl mb-4">
                ⚡
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t("landing.features.realtime")}
              </h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                {t("landing.features.realtimeDesc")}
              </p>
            </div>
            <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent-soft)] flex items-center justify-center text-2xl mb-4">
                ✏️
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t("landing.features.elements")}
              </h3>
              <p className="mt-2 text-[var(--text-secondary)]">
                {t("landing.features.elementsDesc")}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] py-8 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center text-[var(--text-muted)] text-sm">
            {t("landing.footer.tagline")}
          </div>
        </footer>
      </main>
    </div>
  );
}
