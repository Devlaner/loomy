import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("apiFetch refresh error handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthStore.setState({
      token: "old-access-token",
      refreshToken: "refresh-token-1",
      user: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not clear auth state when the refresh call fails at the network level", async () => {
    const fetchMock = vi
      .fn()
      // original request -> 401
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // refresh attempt 1 -> network failure
      .mockRejectedValueOnce(new TypeError("network error"))
      // refresh attempt 2 (retry) -> network failure again
      .mockRejectedValueOnce(new TypeError("network error"));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = apiFetch("/api/boards");
    // Let the internal retry's setTimeout fire.
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe(401);
    // A network-level failure during refresh must NOT be treated as a
    // confirmed-dead session: auth state should be untouched.
    expect(useAuthStore.getState().refreshToken).toBe("refresh-token-1");
    expect(useAuthStore.getState().token).toBe("old-access-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears auth state when the refresh endpoint explicitly rejects the refresh token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch("/api/boards");

    expect(result.status).toBe(401);
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("retries the refresh once and succeeds if the second attempt reaches the server", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "new-token",
          refresh_token: "refresh-token-2",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = apiFetch("/api/boards");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(useAuthStore.getState().token).toBe("new-token");
    expect(useAuthStore.getState().refreshToken).toBe("refresh-token-2");
  });
});
