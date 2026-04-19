/**
 * OAuth callback — API redirects here with ?token=...&refresh_token=...
 * Stores the token pair and navigates to the dashboard.
 */
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { useAuthStore } from "@/stores/authStore";

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const token = searchParams.get("token");
  const refreshToken = searchParams.get("refresh_token");
  const inviteToken = searchParams.get("invite_token");
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setTokens({ token, refreshToken: refreshToken ?? null });
    const acceptMaybe = async () => {
      if (inviteToken) {
        await fetch(
          `${API_BASE}/api/workspaces/invitations/${inviteToken}/accept`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
      navigate("/dashboard", { replace: true });
    };
    void acceptMaybe();
  }, [token, refreshToken, inviteToken, navigate, setTokens, API_BASE]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <PageTitle title="Signing in..." />
      <div className="animate-pulse text-[var(--text-muted)]">
        Signing you in...
      </div>
    </div>
  );
}
