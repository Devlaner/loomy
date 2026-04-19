import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { logoutAndClear } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useState } from "react";
import { Avatar, Dropdown } from "@/components/ui";
import { NotificationIcon } from "@/components/icons";
import { displayNameOf } from "@/lib/identity";
import { AccountSettingsModal } from "@/components/account/AccountSettingsModal";
import { GlobalSearch } from "./GlobalSearch";

interface DashboardShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  workspaceName?: string;
  workspaces?: { id: string; name: string }[];
  selectedWorkspaceId?: string | null;
  onSelectWorkspace?: (id: string) => void;
  onInviteClick?: () => void;
  onWorkspaceSettingsClick?: () => void;
}

export function DashboardShell({
  sidebar,
  children,
  workspaceName,
  workspaces = [],
  selectedWorkspaceId,
  onSelectWorkspace,
  onInviteClick,
  onWorkspaceSettingsClick,
}: DashboardShellProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <aside
        className="w-[248px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden"
        style={{ width: "248px" }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-base font-semibold text-[var(--text-primary)]"
            >
              Loomy
            </Link>
            <Dropdown
              trigger={
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)]">
                  <span className="truncate max-w-[120px]">
                    {workspaceName || t("dashboard.title")}
                  </span>
                  <span className="text-[var(--text-muted)]">▾</span>
                </div>
              }
            >
              {workspaces.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
                  No workspaces
                </div>
              ) : (
                workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => onSelectWorkspace?.(ws.id)}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] ${
                      selectedWorkspaceId === ws.id
                        ? "text-[var(--accent)] bg-[var(--accent-soft)]"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {ws.name}
                  </button>
                ))
              )}
            </Dropdown>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">{sidebar}</nav>
      </aside>
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-secondary)]">
        <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <GlobalSearch />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onInviteClick}
              className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)]"
            >
              {t("dashboard.inviteMembers")}
            </button>
            <button
              type="button"
              aria-label={t("dashboard.notifications") ?? "Notifications"}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-md)] transition-colors"
            >
              <NotificationIcon className="w-5 h-5" />
            </button>
            <Dropdown
              trigger={
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-tertiary)]">
                  <Avatar user={user} size={32} />
                  <span className="text-sm text-[var(--text-primary)]">
                    {displayNameOf(user)}
                  </span>
                  <span aria-hidden className="text-[var(--text-muted)]">
                    ▾
                  </span>
                </div>
              }
              align="right"
            >
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                {t("dashboard.profile") ?? "Account settings"}
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                onClick={onWorkspaceSettingsClick}
              >
                {t("dashboard.workspaceSettings")}
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Docs
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                Keyboard shortcuts
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                onClick={() => {
                  void logoutAndClear().then(() => navigate("/"));
                }}
              >
                {t("common.logout")}
              </button>
            </Dropdown>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[var(--bg-secondary)]">
          {children}
        </main>
      </div>
      {accountOpen && (
        <AccountSettingsModal onClose={() => setAccountOpen(false)} />
      )}
    </div>
  );
}
