import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/context/I18nContext";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";
import { Button, Input } from "@/components/ui";
import { formatApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.detail, "Login failed"));
        return;
      }
      setTokens({
        token: data.access_token,
        refreshToken: data.refresh_token ?? null,
      });
      const inviteToken = searchParams.get("invite_token");
      if (inviteToken) {
        const acceptRes = await fetch(
          `${API_BASE}/api/workspaces/invitations/${inviteToken}/accept`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.access_token}`,
            },
          },
        );
        if (!acceptRes.ok) {
          const acceptData = await acceptRes.json().catch(() => ({}));
          setError(
            formatApiError(
              acceptData.detail,
              "Login succeeded, invite was not accepted",
            ),
          );
        }
      }
      navigate("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleOAuth(provider: "github" | "google") {
    const inviteToken = searchParams.get("invite_token");
    const suffix = inviteToken
      ? `?invite_token=${encodeURIComponent(inviteToken)}`
      : "";
    window.location.href = `${API_BASE}/api/auth/${provider}${suffix}`;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle title={t("common.login")} />
      <Header showAuth showDashboard={false} />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {t("auth.login.title")}
          </h1>
          <p className="mt-1 text-[var(--text-secondary)]">
            {t("auth.login.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Input
              label={t("common.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Input
              label={t("common.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? "..." : t("common.login")}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {t("auth.login.or")}
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              fullWidth
              type="button"
              onClick={() => handleOAuth("github")}
            >
              {t("auth.login.withGitHub")}
            </Button>
            <Button
              variant="outline"
              fullWidth
              type="button"
              onClick={() => handleOAuth("google")}
            >
              {t("auth.login.withGoogle")}
            </Button>
          </div>

          <p className="mt-8 text-center text-[var(--text-secondary)] text-sm">
            {t("auth.login.noAccount")}{" "}
            <Link
              to={`/register${searchParams.get("invite_token") ? `?invite_token=${encodeURIComponent(searchParams.get("invite_token") ?? "")}` : ""}`}
              className="text-[var(--accent)] hover:underline"
            >
              {t("common.signUp")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
