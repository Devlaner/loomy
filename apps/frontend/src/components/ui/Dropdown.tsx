import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}

export function Dropdown({
  trigger,
  children,
  align = "left",
  triggerClassName = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const panelWidth = 180;
      const left = align === "right" ? rect.right - panelWidth : rect.left;
      setPosition({ top: rect.bottom + 4, left });
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left cursor-pointer ${triggerClassName}`}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed z-[9999] min-w-[180px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] py-1"
            onClick={() => setOpen(false)}
            style={{ top: position.top, left: position.left }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
