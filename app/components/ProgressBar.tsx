"use client";

import { useEffect, useRef, useState } from "react";

interface ProgressBarProps {
  readonly label: string;
  readonly value: number; // 0–100
  readonly delay?: number; // ms stagger
}

export default function ProgressBar({ label, value, delay = 0 }: ProgressBarProps) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setWidth(value), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, delay]);

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-brand/80">{label}</span>
        <span className="text-sm font-bold text-brand tabular-nums">{value}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-cream/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-all ease-out"
          style={{ width: `${width}%`, transitionDuration: "1200ms" }}
        />
      </div>
    </div>
  );
}
