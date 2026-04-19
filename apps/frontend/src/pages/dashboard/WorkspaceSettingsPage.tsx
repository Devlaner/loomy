import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/context/I18nContext";
import { Avatar, Button, Input } from "@/components/ui";
import {
  apiFetch,
  formatApiError,
  type Board,
  type BoardListResponse,
  type WorkspaceInvitation,
  type WorkspaceInvitationListResponse,
  type WorkspaceMember,
} from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { DashboardOutletContext } from "@/components/layout/DashboardLayout";

type SettingsTab = "general" | "members" | "analytics";

const ANALYTICS_COLORS = ["#4f46e5", "#0891b2", "#059669", "#d97706"];

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
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const [workspaceNameDrafts, setWorkspaceNameDrafts] = useState<
    Record<string, string>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const isOwner =
    Boolean(user && selectedWorkspace) &&
    user?.id === selectedWorkspace?.owner_id;

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
          err instanceof Error
            ? err.message
            : "Failed to load workspace members",
        );
      })
      .finally(() => {
        setMembersLoading(false);
      });
  };

  const loadBoards = async (workspaceId: string) => {
    setBoardsLoading(true);
    setBoardsError(null);
    await apiFetch(`/api/boards?workspace_id=${workspaceId}&page=1&limit=100`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(formatApiError(data.detail, "Failed to load boards"));
        }
        return res.json() as Promise<BoardListResponse>;
      })
      .then((data) => {
        setBoards(data.items ?? []);
      })
      .catch((err: unknown) => {
        setBoardsError(
          err instanceof Error ? err.message : "Failed to load boards",
        );
      })
      .finally(() => {
        setBoardsLoading(false);
      });
  };

  const loadInvitations = useCallback(
    async (workspaceId: string) => {
      if (!isOwner) {
        setInvitations([]);
        setInvitationsError(null);
        return;
      }
      setInvitationsLoading(true);
      setInvitationsError(null);
      await apiFetch(`/api/workspaces/${workspaceId}/invitations`)
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              formatApiError(data.detail, "Failed to load pending invitations"),
            );
          }
          return res.json() as Promise<WorkspaceInvitationListResponse>;
        })
        .then((data) => setInvitations(data.items ?? []))
        .catch((err: unknown) => {
          setInvitationsError(
            err instanceof Error
              ? err.message
              : "Failed to load pending invitations",
          );
        })
        .finally(() => setInvitationsLoading(false));
    },
    [isOwner],
  );

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    const timer = window.setTimeout(() => {
      void loadMembers(selectedWorkspaceId);
      void loadBoards(selectedWorkspaceId);
      void loadInvitations(selectedWorkspaceId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedWorkspaceId, isOwner, loadInvitations]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const name = (member.display_name ?? member.username ?? "").toLowerCase();
      const email = (member.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, memberSearch]);

  const monthlyBoardActivity = useMemo(() => {
    const byMonth = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, 0);
    }
    for (const board of boards) {
      const date = new Date(board.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (byMonth.has(key)) {
        byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
      }
    }
    return Array.from(byMonth.entries()).map(([key, created]) => {
      const [year, month] = key.split("-");
      return {
        key,
        month: `${month}/${year.slice(2)}`,
        created,
      };
    });
  }, [boards]);

  const boardAgeDistribution = useMemo(() => {
    const latestUpdatedMs = boards.reduce((acc, board) => {
      const updatedMs = new Date(board.updated_at).getTime();
      return Number.isNaN(updatedMs) ? acc : Math.max(acc, updatedMs);
    }, 0);
    let lastWeek = 0;
    let lastMonth = 0;
    let older = 0;
    for (const board of boards) {
      const updatedMs = new Date(board.updated_at).getTime();
      const days = Math.floor(
        (latestUpdatedMs - updatedMs) / (1000 * 60 * 60 * 24),
      );
      if (days <= 7) lastWeek += 1;
      else if (days <= 30) lastMonth += 1;
      else older += 1;
    }
    return [
      { name: t("dashboard.activityLast7Days"), value: lastWeek },
      { name: t("dashboard.activityLast30Days"), value: lastMonth },
      { name: t("dashboard.activityOlder"), value: older },
    ];
  }, [boards, t]);

  const recentMembers = useMemo(() => {
    return [...members].slice(0, 5);
  }, [members]);

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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-primary)] px-5 py-4">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t("dashboard.workspaceSettings")}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {selectedWorkspace.name}
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-primary)] p-2">
        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-sm rounded-[var(--radius-md)] ${
              activeTab === "members"
                ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("dashboard.membersTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm rounded-[var(--radius-md)] ${
              activeTab === "analytics"
                ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t("dashboard.analyticsTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2 text-sm rounded-[var(--radius-md)] ${
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

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-primary)] p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <Input
              label={t("dashboard.searchMembers")}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={t("dashboard.searchByNameOrEmail")}
            />

            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                setInviteError(null);
                setInviteInfo(null);
                setSavingInvite(true);
                const res = await apiFetch(
                  `/api/workspaces/${selectedWorkspaceId}/invitations`,
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
                    formatApiError(data.detail, "Failed to create invitation"),
                  );
                  setSavingInvite(false);
                  return;
                }
                const createdInvitation =
                  (await res.json()) as WorkspaceInvitation;
                setInviteEmail("");
                setInviteInfo(t("dashboard.inviteCreated"));
                await fetchWorkspaces();
                await loadMembers(selectedWorkspaceId);
                await loadInvitations(selectedWorkspaceId);
                setCopiedInviteId(createdInvitation.id);
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
              <Button
                type="button"
                variant="outline"
                disabled={!isOwner}
                onClick={async () => {
                  const latest = invitations[0];
                  if (!latest) {
                    setInviteError(t("dashboard.noPendingInvitations"));
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(latest.invite_url);
                    setCopiedInviteId(latest.id);
                    setInviteInfo(t("dashboard.inviteLinkCopied"));
                    window.setTimeout(() => setCopiedInviteId(null), 1500);
                  } catch {
                    setInviteError(t("dashboard.inviteLinkCopyFailed"));
                  }
                }}
              >
                {copiedInviteId === invitations[0]?.id
                  ? t("dashboard.inviteLinkCopiedShort")
                  : t("dashboard.copyLatestInviteLink")}
              </Button>
            </form>
          </div>

          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          {inviteInfo && (
            <p className="text-sm text-[var(--text-secondary)]">{inviteInfo}</p>
          )}
          {invitationsError && (
            <p className="text-sm text-red-600">{invitationsError}</p>
          )}
          {membersError && (
            <p className="text-sm text-red-600">{membersError}</p>
          )}

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden bg-[var(--bg-primary)]">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                {t("dashboard.pendingInvitations")}
              </h3>
            </div>
            {invitationsLoading ? (
              <div className="px-4 py-4 text-sm text-[var(--text-muted)]">
                Loading...
              </div>
            ) : invitations.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[var(--text-muted)]">
                {t("dashboard.noPendingInvitations")}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {invitation.email}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(invitation.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            invitation.invite_url,
                          );
                          setCopiedInviteId(invitation.id);
                          setInviteInfo(t("dashboard.inviteLinkCopied"));
                          window.setTimeout(
                            () => setCopiedInviteId(null),
                            1500,
                          );
                        } catch {
                          setInviteError(t("dashboard.inviteLinkCopyFailed"));
                        }
                      }}
                    >
                      {copiedInviteId === invitation.id
                        ? t("dashboard.inviteLinkCopiedShort")
                        : t("dashboard.copyInviteLink")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3 px-4 py-3 text-xs uppercase tracking-wide text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
              <span>{t("dashboard.name")}</span>
              <span>{t("dashboard.role")}</span>
              <span className="text-right">{t("dashboard.actions")}</span>
            </div>

            {membersLoading ? (
              <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
                Loading...
              </div>
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
                  <div className="min-w-0 flex items-center gap-3">
                    <Avatar user={member} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {member.display_name ||
                          member.username ||
                          member.email ||
                          member.user_id}
                      </p>
                      {member.email && (
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {member.email}
                        </p>
                      )}
                    </div>
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

      {activeTab === "analytics" && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-primary)]">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                {t("dashboard.totalBoards")}
              </p>
              <p className="text-2xl font-semibold text-[var(--text-primary)] mt-2">
                {boards.length}
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-primary)]">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                {t("dashboard.totalMembers")}
              </p>
              <p className="text-2xl font-semibold text-[var(--text-primary)] mt-2">
                {members.length}
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-primary)]">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                {t("dashboard.boardsPerMember")}
              </p>
              <p className="text-2xl font-semibold text-[var(--text-primary)] mt-2">
                {members.length > 0
                  ? (boards.length / members.length).toFixed(1)
                  : "0.0"}
              </p>
            </div>
          </div>

          {(boardsLoading || membersLoading) && (
            <p className="text-sm text-[var(--text-muted)]">
              {t("dashboard.loadingAnalytics")}
            </p>
          )}
          {boardsError && <p className="text-sm text-red-600">{boardsError}</p>}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-primary)] shadow-[var(--shadow-sm)]">
              <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
                {t("dashboard.boardCreationTrend")}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyBoardActivity}>
                    <defs>
                      <linearGradient
                        id="boardsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#4f46e5"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="#4f46e5"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      fill="url(#boardsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-primary)] shadow-[var(--shadow-sm)]">
              <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
                {t("dashboard.activityDistribution")}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={boardAgeDistribution}
                      innerRadius={54}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {boardAgeDistribution.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index.toString()}`}
                          fill={
                            ANALYTICS_COLORS[index % ANALYTICS_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-sm mt-2">
                {boardAgeDistribution.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-[var(--text-secondary)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            ANALYTICS_COLORS[index % ANALYTICS_COLORS.length],
                        }}
                      />
                      {item.name}
                    </span>
                    <span className="text-[var(--text-primary)]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 bg-[var(--bg-primary)] shadow-[var(--shadow-sm)]">
            <h3 className="text-base font-medium text-[var(--text-primary)] mb-3">
              {t("dashboard.recentMembers")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recentMembers.map((member) => (
                <div
                  key={member.id}
                  className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] flex items-center gap-2"
                >
                  <Avatar user={member} size={28} />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {member.display_name ||
                        member.username ||
                        member.email ||
                        member.user_id}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
              {recentMembers.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  {t("dashboard.noMembersFound")}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "general" && (
        <section className="space-y-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 space-y-4 bg-[var(--bg-primary)] shadow-[var(--shadow-sm)]">
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
                disabled={
                  !isOwner || savingGeneral || !effectiveWorkspaceName.trim()
                }
              >
                {t("common.save")}
              </Button>
              {generalError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {generalError}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-red-300 p-4 space-y-3 bg-[var(--bg-primary)]">
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
                const confirmed = window.confirm(
                  t("dashboard.deleteWorkspaceConfirm"),
                );
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
