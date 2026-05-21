import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-cream/60 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-2 gap-10 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1 flex flex-col gap-4">
          <span className="text-xl font-semibold tracking-tight">
            <span className="text-brand">Echo Psychology</span>
            <span className="text-slate-700"> Group</span>
          </span>
          <p className="text-sm leading-6 text-slate-400 max-w-xs">
            Connecting people with licensed therapists — whenever and wherever they need support.
          </p>
          <div className="flex gap-4 mt-1">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-slate-400 hover:text-brand transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-400 hover:text-brand transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" /></svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-slate-400 hover:text-brand transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" /></svg>
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-600">Platform</h3>
          <ul className="flex flex-col gap-3 text-sm text-slate-400">
            <li><Link href="/#how" className="hover:text-brand transition-colors">How it works</Link></li>
            <li><Link href="/#therapists" className="hover:text-brand transition-colors">Find a therapist</Link></li>
            <li><Link href="/#pricing" className="hover:text-brand transition-colors">Pricing</Link></li>
            <li><Link href="/organizations" className="hover:text-brand transition-colors">For organizations</Link></li>
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-600">Resources</h3>
          <ul className="flex flex-col gap-3 text-sm text-slate-400">
            <li><Link href="/blog" className="hover:text-brand transition-colors">Blog</Link></li>
            <li><Link href="/guides" className="hover:text-brand transition-colors">Mental health guides</Link></li>
            <li><Link href="/crisis" className="hover:text-brand transition-colors">Crisis support</Link></li>
            <li><Link href="/faq" className="hover:text-brand transition-colors">FAQ</Link></li>
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-600">Company</h3>
          <ul className="flex flex-col gap-3 text-sm text-slate-400">
            <li><Link href="/about" className="hover:text-brand transition-colors">About us</Link></li>
            <li><Link href="/careers" className="hover:text-brand transition-colors">Careers</Link></li>
            <li><Link href="/press" className="hover:text-brand transition-colors">Press</Link></li>
            <li><Link href="/contact" className="hover:text-brand transition-colors">Contact</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} Echo Health, Inc. All rights reserved.</span>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-brand transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-brand transition-colors">Terms of Service</Link>
          <Link href="/cookies" className="hover:text-brand transition-colors">Cookie Settings</Link>
        </div>
      </div>
    </footer>
  );
}
