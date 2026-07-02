"use client";

import { useEffect, useRef, useState } from "react";

// Defers mounting its children until the wrapper scrolls near the viewport.
// Used to keep heavy, below-the-fold widgets (e.g. the recharts rating chart,
// whose layout measurement forces a ~150ms synchronous reflow) off the initial
// load's main thread. `placeholder` reserves the final height so mounting the
// real content doesn't shift the layout.
export function MountOnVisible({
  children,
  className,
  placeholder = null,
  rootMargin = "200px",
}: {
  children: React.ReactNode;
  className?: string;
  placeholder?: React.ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    // Without IntersectionObserver (very old browsers), mount on the next
    // frame rather than never showing the content.
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : placeholder}
    </div>
  );
}
