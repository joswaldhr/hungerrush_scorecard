"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface SectionDef {
  id: string;
  label: string;
  hidden?: boolean;
}

function getScrollContainer(): HTMLElement {
  return document.getElementById("main-content") ?? document.documentElement;
}

export function SectionNav({ sections }: { sections: SectionDef[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);
  const scrollingRef = useRef(false);

  const visibleIds = useMemo(
    () => sections.filter((s) => !s.hidden).map((s) => s.id),
    [sections]
  );

  const visible = sections.filter((s) => !s.hidden);

  useEffect(() => {
    const root = getScrollContainer();
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { root, rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const id of visibleIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visibleIds]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const container = getScrollContainer();
    const navHeight = navRef.current?.offsetHeight ?? 48;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const top = elRect.top - containerRect.top + container.scrollTop - navHeight - 16;

    scrollingRef.current = true;
    setActiveId(id);
    container.scrollTop = top;
    setTimeout(() => {
      scrollingRef.current = false;
    }, 300);
  }

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-30 -mx-1 flex items-center gap-1 overflow-x-auto border-b border-border/60 bg-background/95 backdrop-blur-sm px-1 py-1.5"
      aria-label="Page sections"
    >
      {visible.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollTo(section.id)}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
            activeId === section.id
              ? "bg-[#009ca6]/10 text-[#009ca6] dark:bg-[#009ca6]/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
