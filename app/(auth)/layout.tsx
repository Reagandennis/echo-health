import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "Account",
    template: "%s | Echo Health",
  },
};

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex font-sans">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand flex-col justify-between p-12">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          <span className="text-white">echo</span>
          <span className="text-cream">health</span>
        </Link>

        <div className="max-w-sm">
          <blockquote className="text-white/90 text-2xl font-medium leading-snug">
            &ldquo;The greatest revolution of our generation is the discovery
            that human beings, by changing the inner attitudes of their minds,
            can change the outer aspects of their lives.&rdquo;
          </blockquote>
          <p className="mt-4 text-white/50 text-sm">— William James</p>
        </div>

        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} Echo Health, Inc.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile logo */}
        <Link href="/" className="lg:hidden mb-10 text-xl font-semibold tracking-tight">
          <span className="text-brand">echo</span>
          <span className="text-cream">health</span>
        </Link>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
