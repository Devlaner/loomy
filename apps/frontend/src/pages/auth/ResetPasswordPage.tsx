import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";
import { Button, Input } from "@/components/ui";
import { formatApiError } from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch(`${API_BASE}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(formatApiError(body.detail, "Reset failed. Try again."));
        setStatus("idle");
        return;
      }
      setStatus("done");
      // Small delay so the user sees the confirmation before redirect.
      setTimeout(() => navigate("/login"), 1500);
    } catch {
      setError("Network error.");
      setStatus("idle");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle title="Set a new password" />
      <Header showAuth showDashboard={false} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Set a new password
          </h1>
          <p className="mt-1 text-[var(--text-secondary)]">
            Pick something you don&apos;t use anywhere else.
          </p>

          {status === "done" ? (
            <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4 text-sm text-[var(--text-primary)]">
              Password updated. Redirecting to sign in...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Input
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
              {error && <p className="text-sm text-[var(--error)]">{error}</p>}
              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "..." : "Update password"}
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-[var(--text-secondary)] text-sm">
            <Link to="/login" className="text-[var(--accent)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
