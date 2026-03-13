import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { PageTitle } from "@/components/PageTitle";
import { BoardActions } from "@/components/board";
import { Button, Card, Input, Modal, Skeleton } from "@/components/ui";
import { apiFetch, formatApiError } from "@/lib/api";
import { useRecentBoards } from "@/hooks/useRecentBoards";
import { useStarredBoards } from "@/hooks/useStarredBoards";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import type { BoardWithMeta } from "@/lib/api";

const WEEK_AGO = new Date(Date.now() - 7 * 86400000);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  if (diff < 604800000)
    return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentPage() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const { searchQuery, selectedWorkspaceId } = useDashboardStore();
  const { boards, loading, error, fetchRecentBoards, setBoardStarred } =
    useRecentBoards();
  const { starBoard, unstarBoard } = useStarredBoards();
  const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
  const [renameBoardValue, setRenameBoardValue] = useState("");
  const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);

  const handleStar = useCallback(
    async (boardId: string) => {
      setBoardStarred(boardId, true);
      await starBoard(boardId);
    },
    [starBoard, setBoardStarred],
  );

  const handleUnstar = useCallback(
    async (boardId: string) => {
      setBoardStarred(boardId, false);
      await unstarBoard(boardId);
    },
    [unstarBoard, setBoardStarred],
  );

  const handleRename = useCallback(
    async (boardId: string, name: string) => {
      const res = await apiFetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setRenameBoardId(null);
        setRenameBoardValue("");
        fetchRecentBoards();
      }
    },
    [fetchRecentBoards],
  );

  const handleDuplicate = useCallback(
    async (boardId: string) => {
      const res = await apiFetch(`/api/boards/${boardId}/duplicate`, {
        method: "POST",
      });
      if (res.ok) fetchRecentBoards();
    },
    [fetchRecentBoards],
  );

  const handleDelete = useCallback(
    async (boardId: string) => {
      const res = await apiFetch(`/api/boards/${boardId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteBoardId(null);
        fetchRecentBoards();
      }
    },
    [fetchRecentBoards],
  );

  useEffect(() => {
    fetchRecentBoards();
  }, [fetchRecentBoards]);

  const filtered = useMemo(() => {
    let result = boards;
    if (selectedWorkspaceId) {
      result = result.filter((b) => b.workspace_id === selectedWorkspaceId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q));
    }
    return result;
  }, [boards, searchQuery, selectedWorkspaceId]);

  const groups = useMemo(() => {
    const weekAgo = WEEK_AGO;
    const lastWeek: BoardWithMeta[] = [];
    const older: BoardWithMeta[] = [];
    for (const b of filtered) {
      const opened = b.last_opened_at
        ? new Date(b.last_opened_at)
        : new Date(b.updated_at);
      if (opened >= weekAgo) lastWeek.push(b);
      else older.push(b);
    }
    const result: { label: string; boards: BoardWithMeta[] }[] = [];
    if (lastWeek.length)
      result.push({ label: t("dashboard.lastWeek"), boards: lastWeek });
    if (older.length)
      result.push({ label: t("dashboard.older"), boards: older });
    return result;
  }, [filtered, t]);

  if (!user) return null;

  return (
    <div className="p-6">
      <PageTitle title={t("dashboard.recent")} />
      <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
        {t("dashboard.recent")}
      </h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        {t("dashboard.boardsInTeam")}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
          {formatApiError(error, "Something went wrong")}
        </div>
      )}

      {loading ? (
        <div className="rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--text-primary)]">
                  {t("dashboard.name")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-primary)]">
                  {t("dashboard.lastModified")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-primary)]">
                  {t("dashboard.owner")}
                </th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="hover:bg-[var(--bg-tertiary)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-8 h-8" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-3 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-3 w-20" />
                  </td>
                  <td className="px-2 py-3">
                    <Skeleton className="h-6 w-10 rounded-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <Card variant="flat" className="p-8 text-center">
          <p className="text-[var(--text-secondary)]">
            {t("dashboard.noRecentBoards")}
          </p>
        </Card>
      ) : (
        <div className="rounded-[var(--radius-md)] overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--text-primary)]">
                  {t("dashboard.name")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-primary)]">
                  {t("dashboard.lastModified")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-primary)]">
                  {t("dashboard.owner")}
                </th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {groups.map(({ label, boards: groupBoards }) => (
                <React.Fragment key={label}>
                  <tr className="bg-[var(--bg-secondary)]">
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-[11px] font-semibold text-[var(--text-primary)] tracking-wide"
                    >
                      {label}
                    </td>
                  </tr>
                  {groupBoards.map((board) => (
                    <tr
                      key={board.id}
                      className="hover:bg-[var(--bg-tertiary)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/boards/${board.id}`}
                          className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)]"
                        >
                          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-soft)] shrink-0" />
                          {board.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {formatDate(board.last_opened_at || board.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {board.owner_username === user?.username
                          ? t("dashboard.you")
                          : (board.owner_username ?? "—")}
                      </td>
                      <td className="px-2 py-3">
                        <BoardActions
                          starred={board.starred ?? false}
                          t={t}
                          onStar={() => handleStar(board.id)}
                          onUnstar={() => handleUnstar(board.id)}
                          onCopyLink={() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/boards/${board.id}`,
                            )
                          }
                          onOpenInNewTab={() =>
                            window.open(
                              `${window.location.origin}/boards/${board.id}`,
                              "_blank",
                            )
                          }
                          onRename={() => {
                            setRenameBoardId(board.id);
                            setRenameBoardValue(board.name);
                          }}
                          onDuplicate={() => handleDuplicate(board.id)}
                          onDelete={() => setDeleteBoardId(board.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renameBoardId && (
        <Modal
          title={t("dashboard.renameBoard")}
          onClose={() => {
            setRenameBoardId(null);
            setRenameBoardValue("");
          }}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setRenameBoardId(null);
                  setRenameBoardValue("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() =>
                  handleRename(renameBoardId, renameBoardValue.trim())
                }
              >
                {t("common.save")}
              </Button>
            </>
          }
        >
          <Input
            label={t("dashboard.name")}
            value={renameBoardValue}
            onChange={(e) => setRenameBoardValue(e.target.value)}
            placeholder="Board name"
            autoFocus
          />
        </Modal>
      )}

      {deleteBoardId && (
        <Modal
          title={t("dashboard.deleteBoard")}
          onClose={() => setDeleteBoardId(null)}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setDeleteBoardId(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="outline"
                type="button"
                className="text-red-600 hover:text-red-700 hover:border-red-500"
                onClick={() => {
                  handleDelete(deleteBoardId);
                }}
              >
                {t("dashboard.deleteBoard")}
              </Button>
            </>
          }
        >
          <p className="text-[var(--text-secondary)]">
            Are you sure you want to delete this board? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
