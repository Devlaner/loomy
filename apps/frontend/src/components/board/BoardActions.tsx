import { Dropdown } from "@/components/ui";
import { StarFilledIcon, StarOutlineIcon } from "@/components/icons";

interface BoardActionsProps {
  starred: boolean;
  t: (key: string) => string;
  onStar: () => void;
  onUnstar: () => void;
  onCopyLink: () => void;
  onOpenInNewTab: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  variant?: "row" | "card";
}

function DropdownSeparator() {
  return <div className="my-1 border-t border-[var(--border)]" />;
}

function DropdownItem({
  onClick,
  children,
  disabled,
  destructive,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
        disabled
          ? "text-[var(--text-muted)] cursor-not-allowed opacity-60"
          : destructive
            ? "hover:bg-red-500/10 text-red-600 dark:text-red-400"
            : "hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

export function BoardActions({
  starred,
  t,
  onStar,
  onUnstar,
  onCopyLink,
  onOpenInNewTab,
  onRename,
  onDuplicate,
  onDelete,
  variant = "row",
}: BoardActionsProps) {
  const handleStarToggle = () => {
    if (starred) onUnstar();
    else onStar();
  };

  const buttonClass =
    variant === "card"
      ? "p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      : "p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]";

  const starClass = starred ? "text-[var(--accent)]" : "";

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleStarToggle}
        className={`${buttonClass} ${starClass}`}
        title={
          starred
            ? t("dashboard.unstarThisBoard")
            : t("dashboard.starThisBoard")
        }
      >
        {starred ? (
          <StarFilledIcon className="text-[var(--accent)]" />
        ) : (
          <StarOutlineIcon className="text-[var(--text-muted)]" />
        )}
      </button>
      <Dropdown
        trigger={
          <button type="button" className={buttonClass}>
            ⋮
          </button>
        }
        align="right"
      >
        <DropdownItem onClick={onCopyLink}>{t("dashboard.share")}</DropdownItem>
        <DropdownItem onClick={onCopyLink}>
          {t("dashboard.copyBoardLink")}
        </DropdownItem>
        <DropdownItem onClick={onOpenInNewTab}>
          {t("dashboard.openInNewTab")}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onClick={handleStarToggle}>
          {starred
            ? t("dashboard.unstarThisBoard")
            : t("dashboard.starThisBoard")}
        </DropdownItem>
        <DropdownItem onClick={onRename}>
          {t("dashboard.renameBoard")}
        </DropdownItem>
        <DropdownItem onClick={onDuplicate}>
          {t("dashboard.duplicateBoard")}
        </DropdownItem>
        <DropdownItem disabled>{t("dashboard.changeThumbnail")}</DropdownItem>
        <DropdownItem disabled>{t("dashboard.boardDetails")}</DropdownItem>
        <DropdownItem disabled>{t("dashboard.makeBoardPrivate")}</DropdownItem>
        <DropdownItem disabled>
          {t("dashboard.downloadBoardBackup")}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem disabled>{t("dashboard.moveToTeam")}</DropdownItem>
        <DropdownItem onClick={onDelete} destructive>
          {t("dashboard.deleteBoard")}
        </DropdownItem>
        <DropdownItem disabled>{t("dashboard.leave")}</DropdownItem>
      </Dropdown>
    </div>
  );
}
