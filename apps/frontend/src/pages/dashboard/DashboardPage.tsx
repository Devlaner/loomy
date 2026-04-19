import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { PageTitle } from "@/components/PageTitle";
import { BoardActions } from "@/components/board";
import { GridViewIcon, ListViewIcon } from "@/components/icons";
import {
  Button,
  Card,
  Input,
  Modal,
  Skeleton,
  Dropdown,
} from "@/components/ui";
import { formatApiError } from "@/lib/api";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useBoards } from "@/hooks/useBoards";
import { useStarredBoards } from "@/hooks/useStarredBoards";
import { useTemplates } from "@/hooks/useTemplates";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import type { Board } from "@/lib/api";

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

export function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    selectedWorkspaceId,
    showCreateBoard,
    newBoardName,
    searchQuery,
    viewMode,
    sortBy,
    filterBy,
    setSelectedWorkspaceId,
    setShowCreateBoard,
    setNewBoardName,
    setViewMode,
    setSortBy,
    setFilterBy,
    resetCreateForms,
  } = useDashboardStore();

  const { workspaces, error: workspacesError } = useWorkspaces();

  const {
    boards,
    loading: boardsLoading,
    error: boardsError,
    fetchBoards,
    createBoard,
    createBoardFromTemplate,
    updateBoard,
    deleteBoard,
    duplicateBoard,
  } = useBoards(selectedWorkspaceId);

  const { templates } = useTemplates();
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<
    string | null
  >(null);

  const {
    boards: starredBoards,
    fetchStarredBoards,
    starBoard,
    unstarBoard,
  } = useStarredBoards();
  const starredIds = useMemo(
    () => new Set(starredBoards.map((b) => b.id)),
    [starredBoards],
  );

  const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
  const [renameBoardValue, setRenameBoardValue] = useState("");
  const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId, setSelectedWorkspaceId]);

  useEffect(() => {
    fetchBoards();
  }, [selectedWorkspaceId, fetchBoards]);

  useEffect(() => {
    fetchStarredBoards();
  }, [fetchStarredBoards]);

  const filteredAndSortedBoards = useMemo(() => {
    let result = [...boards];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (filterBy === "owned" && user) {
      // Match either modern username or the shared user id exposure.
      result = result.filter((b) => b.owner_username === user.username);
    }
    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created")
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
    return result;
  }, [boards, searchQuery, filterBy, sortBy, user]);

  const filterLabel =
    filterBy === "owned"
      ? t("dashboard.filterOwned")
      : t("dashboard.filterAll");

  const sortLabel =
    sortBy === "name"
      ? t("dashboard.sortName")
      : sortBy === "created"
        ? t("dashboard.sortCreated")
        : t("dashboard.sortLastOpened");

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    const board = await createBoard(newBoardName.trim());
    if (board) {
      resetCreateForms();
      setShowCreateBoard(false);
      navigate(`/boards/${board.id}`);
    }
  }

  async function handlePickTemplate(slug: string) {
    if (creatingFromTemplate) return;
    setCreatingFromTemplate(slug);
    try {
      const board = await createBoardFromTemplate("", slug);
      if (board) navigate(`/boards/${board.id}`);
    } finally {
      setCreatingFromTemplate(null);
    }
  }

  if (!user) return null;

  return (
    <>
      <PageTitle title={t("dashboard.title")} />
      <div className="p-6">
        {(workspacesError || boardsError) && (
          <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
            {formatApiError(
              workspacesError || boardsError,
              "Something went wrong",
            )}
          </div>
        )}
        {!selectedWorkspaceId ? (
          <p className="text-[var(--text-secondary)]">
            {t("dashboard.selectWorkspace")}
          </p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-base font-medium text-[var(--text-primary)] mb-4">
                {t("dashboard.templatesFor")}
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBoard(true)}
                  className="shrink-0 w-48 h-28 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <span
                    aria-hidden
                    className="text-2xl text-[var(--text-muted)]"
                  >
                    +
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] mt-1">
                    {t("dashboard.blankBoard")}
                  </span>
                </button>
                {templates
                  .filter((tpl) => tpl.slug !== "blank")
                  .map((tpl) => {
                    const busy = creatingFromTemplate === tpl.slug;
                    return (
                      <button
                        key={tpl.slug}
                        type="button"
                        disabled={creatingFromTemplate !== null}
                        onClick={() => handlePickTemplate(tpl.slug)}
                        className="shrink-0 w-48 h-28 flex flex-col items-start justify-between text-left p-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-60 disabled:cursor-wait"
                        title={tpl.description}
                      >
                        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                          {tpl.category}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
                          {tpl.name}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {busy ? "Creating..." : "Use template"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-[var(--text-primary)]">
                  {t("dashboard.boardsInTeam")}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateBoard(true)}
                  className="inline-flex items-center gap-1 rounded-full px-3"
                >
                  <span className="text-base leading-none">＋</span>
                  <span>{t("dashboard.createNew")}</span>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {t("dashboard.filterAll")}
                    </span>
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          className="flex items-center justify-between gap-2 pl-3 pr-2 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        >
                          <span className="truncate max-w-[120px] text-left">
                            {filterLabel}
                          </span>
                          <span className="text-[var(--text-muted)] text-xs">
                            ▾
                          </span>
                        </button>
                      }
                    >
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        onClick={() => setFilterBy("all")}
                      >
                        {t("dashboard.filterAll")}
                      </button>
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        onClick={() => setFilterBy("owned")}
                      >
                        {t("dashboard.filterOwned")}
                      </button>
                    </Dropdown>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {t("dashboard.sortLastOpened")}
                    </span>
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          className="flex items-center justify-between gap-2 pl-3 pr-2 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        >
                          <span className="truncate max-w-[140px] text-left">
                            {sortLabel}
                          </span>
                          <span className="text-[var(--text-muted)] text-xs">
                            ▾
                          </span>
                        </button>
                      }
                    >
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        onClick={() => setSortBy("lastModified")}
                      >
                        {t("dashboard.sortLastOpened")}
                      </button>
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        onClick={() => setSortBy("name")}
                      >
                        {t("dashboard.sortName")}
                      </button>
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                        onClick={() => setSortBy("created")}
                      >
                        {t("dashboard.sortCreated")}
                      </button>
                    </Dropdown>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center justify-center p-2 rounded-full transition-colors ${
                      viewMode === "grid"
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                    title="Grid view"
                  >
                    <GridViewIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`flex items-center justify-center p-2 rounded-full transition-colors ${
                      viewMode === "list"
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                    title="List view"
                  >
                    <ListViewIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {boardsLoading ? (
                viewMode === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} variant="flat" className="p-4 h-full">
                        <Skeleton className="w-10 h-10 mb-3" />
                        <Skeleton className="h-4 w-2/3 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </Card>
                    ))}
                  </div>
                ) : (
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
                          <th className="w-10" />
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
                )
              ) : filteredAndSortedBoards.length === 0 ? (
                <Card variant="flat" className="p-8 text-center">
                  <p className="text-[var(--text-secondary)] mb-4">
                    {t("dashboard.noBoardsHint")}
                  </p>
                  <Button onClick={() => setShowCreateBoard(true)}>
                    {t("dashboard.createBoard")}
                  </Button>
                </Card>
              ) : viewMode === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAndSortedBoards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      user={user}
                      t={t}
                      starred={starredIds.has(board.id)}
                      starBoard={() => starBoard(board.id)}
                      unstarBoard={() => unstarBoard(board.id)}
                      onRename={() => {
                        setRenameBoardId(board.id);
                        setRenameBoardValue(board.name);
                      }}
                      onDuplicate={() => duplicateBoard(board.id)}
                      onDelete={() => setDeleteBoardId(board.id)}
                    />
                  ))}
                </div>
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
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedBoards.map((board) => (
                        <BoardRow
                          key={board.id}
                          board={board}
                          user={user}
                          t={t}
                          starred={starredIds.has(board.id)}
                          starBoard={() => starBoard(board.id)}
                          unstarBoard={() => unstarBoard(board.id)}
                          onRename={() => {
                            setRenameBoardId(board.id);
                            setRenameBoardValue(board.name);
                          }}
                          onDuplicate={() => duplicateBoard(board.id)}
                          onDelete={() => setDeleteBoardId(board.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {showCreateBoard && (
        <Modal
          title={t("dashboard.createBoard")}
          onClose={() => setShowCreateBoard(false)}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowCreateBoard(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" form="create-board-form">
                {t("common.save")}
              </Button>
            </>
          }
        >
          <form id="create-board-form" onSubmit={handleCreateBoard}>
            <Input
              label={t("dashboard.name")}
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="New board"
              required
              autoFocus
            />
          </form>
        </Modal>
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
                onClick={async () => {
                  const updated = await updateBoard(
                    renameBoardId,
                    renameBoardValue.trim(),
                  );
                  if (updated) {
                    setRenameBoardId(null);
                    setRenameBoardValue("");
                  }
                }}
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
                onClick={async () => {
                  const ok = await deleteBoard(deleteBoardId);
                  if (ok) setDeleteBoardId(null);
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
    </>
  );
}

function BoardCard({
  board,
  user,
  t,
  starred,
  starBoard,
  unstarBoard,
  onRename,
  onDuplicate,
  onDelete,
}: {
  board: Board;
  user: { username?: string };
  t: (key: string) => string;
  starred: boolean;
  starBoard: () => void;
  unstarBoard: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const boardUrl = `${window.location.origin}/boards/${board.id}`;
  return (
    <Card
      variant="flat"
      className="p-4 hover:border-[var(--border-focus)] transition-colors h-full relative group"
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <BoardActions
          starred={starred}
          t={t}
          variant="card"
          onStar={starBoard}
          onUnstar={unstarBoard}
          onCopyLink={() => navigator.clipboard.writeText(boardUrl)}
          onOpenInNewTab={() => window.open(boardUrl, "_blank")}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
      <Link to={`/boards/${board.id}`} className="block">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-soft)] mb-2" />
        <p className="font-medium text-[var(--text-primary)]">{board.name}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {formatDate(board.updated_at)} ·{" "}
          {board.owner_username === user?.username
            ? t("dashboard.you")
            : board.owner_display_name || board.owner_username || "—"}
        </p>
      </Link>
    </Card>
  );
}

function BoardRow({
  board,
  user,
  t,
  starred,
  starBoard,
  unstarBoard,
  onRename,
  onDuplicate,
  onDelete,
}: {
  board: Board;
  user: { username?: string };
  t: (key: string) => string;
  starred: boolean;
  starBoard: () => void;
  unstarBoard: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const boardUrl = `${window.location.origin}/boards/${board.id}`;
  return (
    <tr className="hover:bg-[var(--bg-tertiary)]">
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
        {formatDate(board.updated_at)}
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">
        {board.owner_username === user?.username
          ? t("dashboard.you")
          : board.owner_display_name || board.owner_username || "—"}
      </td>
      <td className="px-2 py-3">
        <BoardActions
          starred={starred}
          t={t}
          onStar={starBoard}
          onUnstar={unstarBoard}
          onCopyLink={() => navigator.clipboard.writeText(boardUrl)}
          onOpenInNewTab={() => window.open(boardUrl, "_blank")}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}
