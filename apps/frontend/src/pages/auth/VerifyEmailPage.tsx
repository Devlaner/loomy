import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/PageTitle";
import { Header } from "@/components/layout";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"verifying" | "ok" | "failed">(
    "verifying",
  );

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => setStatus("failed"));
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/email/verify/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        setStatus(res.ok ? "ok" : "failed");
      } catch {
        setStatus("failed");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      <PageTitle title="Verify email" />
      <Header showAuth showDashboard={false} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {status === "verifying" && "Verifying your email..."}
            {status === "ok" && "Email verified"}
            {status === "failed" && "Verification failed"}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            {status === "ok" &&
              "Thanks — your email is confirmed. You can sign in now."}
            {status === "failed" &&
              "This link is invalid or has expired. Request a new one from your account settings."}
          </p>
          {status !== "verifying" && (
            <div className="mt-6">
              <Link
                to="/login"
                className="text-[var(--accent)] hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
