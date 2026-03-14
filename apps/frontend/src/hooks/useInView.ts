import { useEffect, useRef, useState } from "react";

/** Returns true when the element is in view. Used for subtle fade-in (opacity only). */
export function useInView(options?: {
  rootMargin?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = "0px 0px -40px 0px", threshold = 0 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return { ref, inView };
}
