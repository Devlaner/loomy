import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { Button, Input } from "@/components/ui";
import { apiFetch, formatApiError, type WorkspaceMember } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { DashboardOutletContext } from "@/components/layout/DashboardLayout";

type SettingsTab = "general" | "members";

export function WorkspaceSettingsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    fetchWorkspaces,
    updateWorkspace,
    deleteWorkspace,
  } = useOutletContext<DashboardOutletContext>();

  const [activeTab, setActiveTab] = useState<SettingsTab>("members");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);

  const [workspaceNameDrafts, setWorkspaceNameDrafts] = useState<
    Record<string, string>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const selectedWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const isOwner =
    Boolean(user && selectedWorkspace) && user?.id === selectedWorkspace?.owner_id;

  const effectiveWorkspaceName =
    (selectedWorkspaceId && workspaceNameDrafts[selectedWorkspaceId]) ||
    selectedWorkspace?.name ||
    "";

  const loadMembers = async (workspaceId: string) => {
    setMembersLoading(true);
    setMembersError(null);
    await apiFetch(`/api/workspaces/${workspaceId}/members`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            formatApiError(data.detail, "Failed to load workspace members"),
          );
        }
        return res.json() as Promise<{ items?: WorkspaceMember[] }>;
      })
      .then((data) => {
        setMembers(data.items ?? []);
      })
      .catch((err: unknown) => {
        setMembersError(
          err instanceof Error ? err.message : "Failed to load workspace members",
        );
      })
      .finally(() => {
        setMembersLoading(false);
      });
  };

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    const timer = window.setTimeout(() => {
      void loadMembers(selectedWorkspaceId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedWorkspaceId]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const username = (member.username ?? "").toLowerCase();
      const email = (member.email ?? "").toLowerCase();
      return username.includes(q) || email.includes(q);
    });
  }, [members, memberSearch]);

  if (!selectedWorkspaceId || !selectedWorkspace) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
          {t("dashboard.workspaceSettings")}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {t("dashboard.selectWorkspace")}
        </p>
        <Button type="button" onClick={() => navigate("/dashboard")}>
          {t("dashboard.home")}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t("dashboard.workspaceSettings")}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {selectedWorkspace.name}
        </p>
      </div>

      <div className="border-b border-[var(--border)]">
        <nav className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-sm rounded-t-[var(--radius-md)] ${
              activeTab === "members"
                ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("dashboard.membersTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2 text-sm rounded-t-[var(--radius-md)] ${
              activeTab === "general"
                ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("dashboard.generalTab")}
          </button>
        </nav>
      </div>

      {activeTab === "members" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              {t("dashboard.members")} ({members.length})
            </h2>
            <Button type="button" onClick={() => setActiveTab("general")}>
              {t("dashboard.manageWorkspace")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <Input
              label={t("dashboard.searchMembers")}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={t("dashboard.searchByNameOrEmail")}
            />

            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                setInviteError(null);
                setSavingInvite(true);
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
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  setInviteError(
                    formatApiError(data.detail, "Failed to invite member"),
                  );
                  setSavingInvite(false);
                  return;
                }
                setInviteEmail("");
                await fetchWorkspaces();
                await loadMembers(selectedWorkspaceId);
                setSavingInvite(false);
              }}
            >
              <div className="w-64">
                <Input
                  label={t("dashboard.inviteByEmail")}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <Button type="submit" disabled={savingInvite || !isOwner}>
                {t("dashboard.inviteMembers")}
              </Button>
            </form>
          </div>

          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          {membersError && <p className="text-sm text-red-600">{membersError}</p>}

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3 px-4 py-3 text-xs uppercase tracking-wide text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
              <span>{t("dashboard.name")}</span>
              <span>{t("dashboard.role")}</span>
              <span className="text-right">{t("dashboard.actions")}</span>
            </div>

            {membersLoading ? (
              <div className="px-4 py-6 text-sm text-[var(--text-muted)]">Loading...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
                {t("dashboard.noMembersFound")}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[2fr_1fr_auto] gap-3 px-4 py-3 border-t border-[var(--border)] items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {member.username || member.email || member.user_id}
                    </p>
                    {member.email && (
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {member.email}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-secondary)] capitalize">
                    {member.role}
                  </span>
                  <div className="text-right">
                    {member.user_id !== selectedWorkspace.owner_id && (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        disabled={!isOwner && member.user_id !== user?.id}
                        onClick={async () => {
                          const res = await apiFetch(
                            `/api/workspaces/${selectedWorkspaceId}/members/${member.user_id}`,
                            { method: "DELETE" },
                          );
                          if (!res.ok) return;
                          setMembers((prev) =>
                            prev.filter((m) => m.user_id !== member.user_id),
                          );
                        }}
                      >
                        {member.user_id === user?.id
                          ? t("dashboard.leave")
                          : t("dashboard.removeMember")}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === "general" && (
        <section className="space-y-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 space-y-4">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              {t("dashboard.generalTab")}
            </h2>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setGeneralError(null);
                setSavingGeneral(true);
                const updated = await updateWorkspace(
                  selectedWorkspaceId,
                  effectiveWorkspaceName.trim(),
                );
                if (!updated) {
                  setGeneralError("Failed to update workspace");
                  setSavingGeneral(false);
                  return;
                }
                setWorkspaceNameDrafts((prev) => {
                  const next = { ...prev };
                  delete next[selectedWorkspaceId];
                  return next;
                });
                await fetchWorkspaces();
                setSelectedWorkspaceId(updated.id);
                setSavingGeneral(false);
              }}
            >
              <Input
                label={t("dashboard.workspaceName")}
                value={effectiveWorkspaceName}
                onChange={(e) =>
                  setWorkspaceNameDrafts((prev) => ({
                    ...prev,
                    [selectedWorkspaceId]: e.target.value,
                  }))
                }
                required
                disabled={!isOwner}
              />
              <Button
                type="submit"
                disabled={!isOwner || savingGeneral || !effectiveWorkspaceName.trim()}
              >
                {t("common.save")}
              </Button>
              {generalError && (
                <p className="text-sm text-red-600 dark:text-red-400">{generalError}</p>
              )}
            </form>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-red-300 p-4 space-y-3">
            <h3 className="text-base font-medium text-red-700">
              {t("dashboard.dangerZone")}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {t("dashboard.deleteWorkspaceWarning")}
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={!isOwner || deletingWorkspace}
              onClick={async () => {
                const confirmed = window.confirm(t("dashboard.deleteWorkspaceConfirm"));
                if (!confirmed) return;
                setDeletingWorkspace(true);
                const ok = await deleteWorkspace(selectedWorkspaceId);
                setDeletingWorkspace(false);
                if (!ok) {
                  setGeneralError("Failed to delete workspace");
                  return;
                }
                await fetchWorkspaces();
                setSelectedWorkspaceId(null);
                navigate("/dashboard");
              }}
            >
              {t("dashboard.deleteWorkspace")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
