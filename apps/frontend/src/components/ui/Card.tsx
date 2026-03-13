import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "flat";
}

export function Card({
  variant = "elevated",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-[var(--radius-lg)] p-6
        ${variant === "elevated" ? "bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]" : "bg-[var(--bg-secondary)]"}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
