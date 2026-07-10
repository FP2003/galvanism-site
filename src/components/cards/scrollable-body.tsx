"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/*
 * Wraps the card body's scrollable content. Hides the native scrollbar and
 * shows a small fading down-arrow affordance instead, so overflowing card
 * text reads as "more below" rather than a raw scrollbar clashing with the
 * card's design. The arrow disappears once the user scrolls to the bottom.
 */
export function ScrollableBody({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 2;
      setHasMore(el.scrollHeight > el.clientHeight + 1 && !atBottom);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="flex h-full flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {hasMore && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-void-navy to-transparent pt-4"
          aria-hidden="true"
        >
          <ChevronDown size={14} strokeWidth={2.5} className="text-signal-cyan" />
        </div>
      )}
    </>
  );
}
