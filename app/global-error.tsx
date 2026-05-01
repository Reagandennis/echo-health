"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 text-center font-sans">
        <div className="mb-8">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
            <AlertTriangle size={36} className="text-amber-500" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-brand mb-3">Something went wrong</h1>
        <p className="text-brand/55 text-base max-w-sm leading-relaxed mb-2">
          A critical error occurred. We&apos;re sorry for the inconvenience.
        </p>
        {error.digest && (
          <p className="text-xs text-brand/30 font-mono mb-8">Error ID: {error.digest}</p>
        )}
        {!error.digest && <div className="mb-8" />}
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3 rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </body>
    </html>
  );
}
