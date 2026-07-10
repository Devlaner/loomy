import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { DashboardShell } from "@/components/layout";
import { Button, Input, Modal } from "@/components/ui";
import { HomeIcon, RecentIcon, StarOutlineIcon } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardStore } from "@/stores/dashboardStore";

export interface DashboardOutletContext {
  workspaces: { id: string; name: string; owner_id: string }[];
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string | null) => void;
  fetchWorkspaces: () => Promise<void>;
  updateWorkspace: (
    workspaceId: string,
    name: string,
  ) => Promise<{
    id: string;
    name: string;
  } | null>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
}

export function DashboardLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { token, user, setUser, logout } = useAuthStore();
  const {
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    setShowCreateWorkspace,
    showCreateWorkspace,
    newWorkspaceName,
    setNewWorkspaceName,
    resetCreateForms,
    searchQuery,
    setSearchQuery,
  } = useDashboardStore();
  const {
    workspaces,
    loading: workspacesLoading,
    createWorkspace,
    fetchWorkspaces,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaces();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    apiFetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          logout();
          navigate("/login");
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {
        logout();
        navigate("/login");
      });
  }, [token, navigate, logout, setUser]);

  useEffect(() => {
    if (user) fetchWorkspaces();
  }, [user, fetchWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId, setSelectedWorkspaceId]);

  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId,
  );

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm ${
      isActive
        ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
        : "hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
    }`;

  const sidebar = (
    <>
      <input
        type="text"
        placeholder={t("dashboard.searchPlaceholder")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 mb-4 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
      />
      <nav className="space-y-0.5 mb-6">
        <NavLink to="/dashboard" end className={navLinkClass}>
          <HomeIcon className="text-[var(--text-muted)]" />
          {t("dashboard.home")}
        </NavLink>
        <NavLink to="/dashboard/recent" className={navLinkClass}>
          <RecentIcon className="text-[var(--text-muted)]" />
          {t("dashboard.recent")}
        </NavLink>
        <NavLink to="/dashboard/starred" className={navLinkClass}>
          <StarOutlineIcon className="text-[var(--text-muted)]" />
          {t("dashboard.starred")}
        </NavLink>
      </nav>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--text-muted)] px-2">
          {t("dashboard.workspaces")}
        </span>
        <button
          type="button"
          onClick={() => setShowCreateWorkspace(true)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
        >
          +
        </button>
      </div>
      <div className="space-y-0.5">
        {workspacesLoading ? (
          <div className="text-sm text-[var(--text-muted)] px-3 py-2">
            Loading...
          </div>
        ) : (
          workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => setSelectedWorkspaceId(ws.id)}
              className={`w-full text-left px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors ${
                selectedWorkspaceId === ws.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
              }`}
            >
              {ws.name}
            </button>
          ))
        )}
      </div>
    </>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <DashboardShell
        sidebar={sidebar}
        workspaceName={selectedWorkspace?.name}
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelectWorkspace={setSelectedWorkspaceId}
        onInviteClick={() => setShowInviteModal(true)}
        onWorkspaceSettingsClick={() =>
          navigate("/dashboard/workspace-settings")
        }
      >
        <Outlet
          context={{
            workspaces: workspaces.map((w) => ({
              id: w.id,
              name: w.name,
              owner_id: w.owner_id,
            })),
            selectedWorkspaceId,
            setSelectedWorkspaceId,
            fetchWorkspaces,
            updateWorkspace,
            deleteWorkspace,
          }}
        />
      </DashboardShell>

      {showInviteModal && selectedWorkspaceId && (
        <Modal
          title={t("dashboard.inviteByEmail")}
          onClose={() => {
            setShowInviteModal(false);
            setInviteEmail("");
            setInviteError(null);
          }}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail("");
                  setInviteError(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  setInviteError(null);
                  const res = await apiFetch(
                    `/api/workspaces/${selectedWorkspaceId}/members`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        email: inviteEmail.trim(),
                        role: "member",
                      }),
                    },
                  );
                  if (res.ok) {
                    setShowInviteModal(false);
                    setInviteEmail("");
                  } else {
                    const data = await res.json();
                    setInviteError(
                      typeof data.detail === "string"
                        ? data.detail
                        : "Failed to invite",
                    );
                  }
                }}
              >
                {t("dashboard.inviteMembers")}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {inviteError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {inviteError}
              </p>
            )}
            <Input
              label={t("common.email")}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              autoFocus
            />
          </div>
        </Modal>
      )}

      {showCreateWorkspace && (
        <Modal
          title={t("dashboard.createWorkspace")}
          onClose={() => setShowCreateWorkspace(false)}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowCreateWorkspace(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" form="layout-create-workspace-form">
                {t("common.save")}
              </Button>
            </>
          }
        >
          <form
            id="layout-create-workspace-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ws = await createWorkspace(newWorkspaceName.trim());
              if (ws) {
                resetCreateForms();
                setShowCreateWorkspace(false);
                setSelectedWorkspaceId(ws.id);
                fetchWorkspaces();
              }
            }}
          >
            <Input
              label={t("dashboard.name")}
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="My workspace"
              required
              autoFocus
            />
          </form>
        </Modal>
      )}
    </>
  );
}
