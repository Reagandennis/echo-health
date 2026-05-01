import Link from "next/link";
import { Search, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 text-center">
      {/* Illustration */}
      <div className="mb-8 relative">
        <div className="text-[120px] font-black text-brand/8 leading-none select-none">404</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center">
            <Search size={28} className="text-brand/50" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-brand mb-3">Page not found</h1>
      <p className="text-brand/55 text-base max-w-sm leading-relaxed mb-10">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="flex-1 flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all"
        >
          <Home size={15} /> Go home
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 border border-brand/20 text-brand font-semibold py-3 rounded-full hover:bg-brand/5 active:scale-95 transition-all"
        >
          <ArrowLeft size={15} /> Dashboard
        </Link>
      </div>

      <p className="text-xs text-brand/30 mt-10">echo health · support@echohealth.com</p>
    </div>
  );
}
