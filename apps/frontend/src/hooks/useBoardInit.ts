import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

export function useBoardInit(
  boardId: string | null,
  token: string | null,
): { authChecked: boolean; boardName: string } {
  const navigate = useNavigate();
  const [boardName, setBoardName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!boardId || !token) return;
    let cancelled = false;

    apiFetch(`/api/boards/${boardId}`)
      .then((res) => {
        if (!res.ok) {
          navigate("/dashboard");
          return null;
        }
        return res.json();
      })
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          setBoardName(data.name ?? "");
          apiFetch(`/api/boards/${boardId}/open`, { method: "POST" }).catch(
            () => {},
          );
        }
        setAuthChecked(true);
      })
      .catch(() => {
        if (!cancelled) navigate("/dashboard");
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, token, navigate]);

  return { authChecked, boardName };
}
