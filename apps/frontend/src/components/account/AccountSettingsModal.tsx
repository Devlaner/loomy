import { useRef, useState } from "react";
import { Avatar, Button, Input, Modal } from "@/components/ui";
import { apiFetch, formatApiError } from "@/lib/api";
import { displayNameOf } from "@/lib/identity";
import { useAuthStore, type AuthUser } from "@/stores/authStore";

interface Props {
  onClose: () => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function AccountSettingsModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(formatApiError(body.detail, "Could not save profile."));
        return;
      }
      const updated: AuthUser = await res.json();
      setUser(updated);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPEG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Image must be under ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/users/me/avatar", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(formatApiError(body.detail, "Could not upload avatar."));
        return;
      }
      const updated: AuthUser = await res.json();
      setUser(updated);
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAvatarRemove() {
    setError(null);
    setUploading(true);
    try {
      const res = await apiFetch("/api/users/me/avatar", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not remove avatar.");
        return;
      }
      const updated: AuthUser = await res.json();
      setUser(updated);
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Account settings" onClose={onClose}>
      <form onSubmit={handleSaveProfile} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="space-y-1">
            <div className="text-sm text-[var(--text-primary)] font-medium">
              {displayNameOf(user)}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {user?.email}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading..." : "Change photo"}
              </Button>
              {user?.avatar_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={handleAvatarRemove}
                >
                  Remove
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
