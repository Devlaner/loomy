/**
 * OAuth callback – when API redirects here with ?token=...
 * Stores token and navigates to dashboard.
 */
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { useAuthStore } from "@/stores/authStore";

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      setToken(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [token, navigate, setToken]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <PageTitle title="Signing in..." />
      <div className="animate-pulse text-[var(--text-muted)]">
        Signing you in...
      </div>
    </div>
  );
}
