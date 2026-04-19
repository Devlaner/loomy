import { useState } from "react";
import { Link } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";
import { Button, Input } from "@/components/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // The endpoint always returns 200 whether the account exists or
      // not (deliberate, to defeat user enumeration). Any non-200 is a
      // server-side failure worth showing.
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle title="Reset password" />
      <Header showAuth showDashboard={false} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Forgot your password?
          </h1>
          <p className="mt-1 text-[var(--text-secondary)]">
            Enter the email you signed up with and we&apos;ll send a reset link.
          </p>

          {status === "sent" ? (
            <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4 text-sm text-[var(--text-primary)]">
              If an account exists for that email, a reset link is on its way.
              Check your inbox (and spam folder).
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              {status === "error" && (
                <p className="text-sm text-[var(--error)]">
                  Something went wrong. Please try again.
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={status === "sending"}
              >
                {status === "sending" ? "..." : "Send reset link"}
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-[var(--text-secondary)] text-sm">
            Remembered it?{" "}
            <Link to="/login" className="text-[var(--accent)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
