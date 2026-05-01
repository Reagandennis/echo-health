"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  readonly end: number;
  readonly suffix?: string;
  readonly prefix?: string;
  readonly duration?: number; // ms
  readonly label: string;
  readonly className?: string;
  readonly labelClassName?: string;
}

export default function StatCounter({
  end,
  suffix = "",
  prefix = "",
  duration = 2000,
  label,
  className = "text-brand",
  labelClassName = "text-brand/60",
}: StatCounterProps) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className={`text-5xl font-bold tracking-tight tabular-nums ${className}`}>
        {prefix}{count.toLocaleString()}{suffix}
      </span>
      <span className={`text-sm font-medium ${labelClassName}`}>{label}</span>
    </div>
  );
}
