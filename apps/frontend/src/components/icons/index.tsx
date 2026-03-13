import type React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

function mergeClassName(defaultClass: string, className?: string) {
  return className ? `${defaultClass} ${className}` : defaultClass;
}

export function HomeIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-5 h-5", className)}
      {...rest}
    >
      <path
        d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1v-4.5h-3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecentIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-6 h-6", className)}
      {...rest}
    >
      <circle
        cx="12"
        cy="12"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 9v4l2.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarOutlineIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-6 h-6", className)}
      {...rest}
    >
      <path
        d="M12 4.5 14.1 9l4.4.5-3.3 2.9.9 4.4L12 15.5 7.9 16.8l.9-4.4L5.5 9.5 9.9 9 12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarFilledIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-6 h-6", className)}
      {...rest}
    >
      <path
        d="M12 4.5 14.1 9l4.4.5-3.3 2.9.9 4.4L12 15.5 7.9 16.8l.9-4.4L5.5 9.5 9.9 9 12 4.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 2x2 grid of four squares (boards/card view). */
export function GridViewIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-5 h-5", className)}
      {...rest}
    >
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        rx="1"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        rx="1"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        rx="1"
      />
      <rect
        x="13"
        y="13"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        rx="1"
      />
    </svg>
  );
}

/** List view: three horizontal lines, middle longest. */
export function ListViewIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-5 h-5", className)}
      {...rest}
    >
      <path
        d="M5 7h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 17h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Bell icon for notifications. */
export function NotificationIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={mergeClassName("w-5 h-5", className)}
      {...rest}
    >
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
