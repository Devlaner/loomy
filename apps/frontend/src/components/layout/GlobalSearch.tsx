import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, type Board } from "@/lib/api";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Board[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      queueMicrotask(() => setResults([]));
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/boards/search?q=${encodeURIComponent(q)}&limit=10`,
        );
        if (!res.ok) return;
        const body = await res.json();
        setResults(body.items ?? []);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search boards... (Ctrl+K)"
        className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-[var(--border)] bg-[var(--bg-elevated)] rounded shadow-md z-20 max-h-80 overflow-auto">
          {results.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
                navigate(`/boards/${b.id}`);
              }}
              className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <div className="font-medium">{b.name}</div>
              {(b.owner_display_name || b.owner_username) && (
                <div className="text-xs text-[var(--text-muted)]">
                  {b.owner_display_name || b.owner_username}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 px-3 py-2 text-sm text-[var(--text-muted)] border border-[var(--border)] bg-[var(--bg-elevated)] rounded shadow-md z-20">
          No matches.
        </div>
      )}
    </div>
  );
}
