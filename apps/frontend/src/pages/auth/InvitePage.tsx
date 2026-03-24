import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui";
import { apiFetch, formatApiError, type WorkspaceInvitation } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function InvitePage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const authToken = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(Boolean(token));
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<WorkspaceInvitation | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/workspaces/invitations/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(formatApiError(data.detail, "Invitation not found"));
        }
        return res.json() as Promise<WorkspaceInvitation>;
      })
      .then((data) => {
        setInvite(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Invitation not found");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const inviteTokenQuery = useMemo(
    () => (token ? `?invite_token=${encodeURIComponent(token)}` : ""),
    [token],
  );

  async function acceptInvitation() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    const res = await apiFetch(`/api/workspaces/invitations/${token}/accept`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(formatApiError(data.detail, "Failed to accept invitation"));
      setAccepting(false);
      return;
    }
    setSuccess("Invitation accepted. Redirecting to dashboard...");
    window.setTimeout(() => navigate("/dashboard"), 700);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle title="Workspace invitation" />
      <Header showAuth showDashboard={false} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
            Workspace invitation
          </h1>

          {loading && <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
          {!loading && !token && (
            <p className="text-sm text-[var(--error)]">Invitation token is missing</p>
          )}
          {!loading && error && <p className="text-sm text-[var(--error)]">{error}</p>}

          {!loading && invite && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                You are invited to join <strong>{invite.workspace_name}</strong> as{" "}
                <strong>{invite.role}</strong> for <strong>{invite.email}</strong>.
              </p>

              {success && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
              )}

              {authToken ? (
                <Button
                  type="button"
                  fullWidth
                  disabled={accepting}
                  onClick={() => void acceptInvitation()}
                >
                  {accepting ? "Joining..." : "Join workspace"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Link to={`/login${inviteTokenQuery}`}>
                    <Button type="button" fullWidth>
                      Log in to join
                    </Button>
                  </Link>
                  <Link to={`/register${inviteTokenQuery}`}>
                    <Button type="button" variant="outline" fullWidth>
                      Create account to join
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
