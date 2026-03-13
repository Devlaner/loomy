import { Link } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/context/ThemeContext";
import { SUPPORTED_LANGS, LANG_LABELS } from "@/i18n";
import { Button, Dropdown } from "@/components/ui";
import type { Theme } from "@/context/ThemeContext";

const themes: { value: Theme; label: string }[] = [
  { value: "light", label: "☀️" },
  { value: "dark", label: "🌙" },
  { value: "soft", label: "🌸" },
];

interface HeaderProps {
  showAuth?: boolean;
  showDashboard?: boolean;
}

export function Header({
  showAuth = true,
  showDashboard = false,
}: HeaderProps) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link
          to="/"
          className="text-xl font-semibold text-[var(--text-primary)] tracking-tight"
        >
          Loomy
        </Link>

        <nav className="flex items-center gap-4">
          {/* Lang selector */}
          <Dropdown
            trigger={
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer">
                <span className="text-[var(--text-muted)]">🌐</span>
                <span>{LANG_LABELS[lang]}</span>
                <span className="text-[var(--text-muted)] text-xs">▾</span>
              </div>
            }
            align="right"
          >
            {SUPPORTED_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] ${
                  lang === l
                    ? "text-[var(--accent)] bg-[var(--accent-soft)]"
                    : "text-[var(--text-primary)]"
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </Dropdown>

          {/* Theme selector */}
          <div className="flex gap-1">
            {themes.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                title={value}
                className={`w-9 h-9 rounded-[var(--radius-md)] text-lg transition-all ${
                  theme === value
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {showAuth && (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t("common.login")}
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  {t("common.signUp")}
                </Button>
              </Link>
            </div>
          )}

          {showDashboard && (
            <Link to="/dashboard">
              <Button variant="primary" size="sm">
                {t("dashboard.title")}
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
