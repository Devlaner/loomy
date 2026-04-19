import { useState } from "react";
import { displayNameOf, initialsOf, type NamedUser } from "@/lib/identity";

interface AvatarProps {
  user: (NamedUser & { avatar_url?: string | null }) | null | undefined;
  size?: number;
  className?: string;
}

export function Avatar({ user, size = 32, className = "" }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const name = displayNameOf(user);
  const src = user?.avatar_url && !broken ? user.avatar_url : null;

  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "9999px",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`object-cover bg-[var(--bg-tertiary)] ${className}`}
        style={common}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] font-medium ${className}`}
      style={{ ...common, fontSize: Math.max(10, Math.floor(size * 0.38)) }}
    >
      {initialsOf(name)}
    </div>
  );
}
