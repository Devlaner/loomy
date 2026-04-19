import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface BoardTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  thumbnail_url: string | null;
}

export function useTemplates(): {
  templates: BoardTemplate[];
  loading: boolean;
} {
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/templates");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setTemplates(body.items ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, loading };
}
