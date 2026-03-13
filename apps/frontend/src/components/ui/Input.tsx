import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-[var(--radius-lg)]
            bg-[var(--bg-elevated)] border border-[var(--border)]
            text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent
            transition-all duration-[var(--transition-fast)]
            ${error ? "border-[var(--error)]" : ""}
            ${className}
          `.trim()}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-[var(--error)]">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
