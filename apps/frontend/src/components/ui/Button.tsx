import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-muted)]",
  ghost:
    "bg-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
  outline:
    "border-2 border-[var(--border)] bg-transparent hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm rounded-[var(--radius-md)]",
  md: "px-6 py-3 text-base rounded-[var(--radius-md)]",
  lg: "px-8 py-4 text-lg rounded-[var(--radius-md)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", fullWidth, className = "", ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center font-medium cursor-pointer
          transition-all duration-[var(--transition-fast)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `.trim()}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
