export interface NamedUser {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
}

export function displayNameOf(user: NamedUser | null | undefined): string {
  if (!user) return "Unknown";
  if (user.display_name && user.display_name.trim()) return user.display_name;
  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (user.email) {
    const local = user.email.split("@", 1)[0];
    if (local) return local;
  }
  return user.username || "Unknown";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
