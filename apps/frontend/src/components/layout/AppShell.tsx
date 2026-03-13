import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen bg-[var(--bg-secondary)]">
      <aside
        className="w-[248px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col"
        style={{ width: "248px" }}
      >
        <div className="p-4 border-b border-[var(--border)]">
          <Link
            to="/dashboard"
            className="text-base font-semibold text-[var(--text-primary)]"
          >
            Loomy
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">{sidebar}</nav>
        <div className="p-4 border-t border-[var(--border)]">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              {t("dashboard.title")}
            </Button>
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-[var(--bg-secondary)]">
        {children}
      </main>
    </div>
  );
}
