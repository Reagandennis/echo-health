"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
          <div className="w-13 h-13 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle size={36} className="text-amber-500" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-brand mb-3">Something went wrong</h1>
      <p className="text-brand/55 text-base max-w-sm leading-relaxed mb-2">
        An unexpected error occurred. Our team has been notified.
      </p>
      {error.digest && (
        <p className="text-xs text-brand/30 font-mono mb-8">Error ID: {error.digest}</p>
      )}
      {!error.digest && <div className="mb-8" />}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="flex-1 flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all"
        >
          <RefreshCw size={15} /> Try again
        </button>
        <button
          onClick={() => router.push("/")}
          className="flex-1 flex items-center justify-center gap-2 border border-brand/20 text-brand font-semibold py-3 rounded-full hover:bg-brand/5 active:scale-95 transition-all"
        >
          <Home size={15} /> Go home
        </button>
      </div>
    </div>
  );
}
