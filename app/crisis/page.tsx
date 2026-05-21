import { AlertTriangle, Phone, MessageSquare, ArrowLeft, Globe } from "lucide-react";
import Link from "next/link";
import Footer from "../components/Footer";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Crisis resources & emergency support",
  description:
    "If you are in crisis, immediate help is available. International crisis hotlines, text lines, and emergency resources for mental health emergencies.",
  path: "/crisis",
});

export default function CrisisPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-slate-50 min-h-screen">
      <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-red-50 border border-red-100 p-8 sm:p-12 mb-12 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-6">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-red-900 mb-4">
              If you are in immediate danger, please call 911 or go to your nearest emergency room.
            </h1>
            <p className="text-red-700 text-lg">
              Echo Health is not a crisis response service. If you are experiencing a mental health emergency, having thoughts of suicide, or considering harming yourself or others, immediate help is available.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-6">Immediate Resources (United States)</h2>
          
          <div className="grid gap-6 sm:grid-cols-2 mb-16">
            <a 
              href="tel:988"
              className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 border-slate-200 hover:border-brand/40 transition-colors group"
            >
              <Phone className="h-8 w-8 text-slate-800 mb-4 group-hover:text-brand transition-colors" />
              <h3 className="font-bold text-xl text-slate-800 mb-2">988 Suicide & Crisis Lifeline</h3>
              <p className="text-slate-500 text-sm mb-4">24/7, free and confidential support for people in distress.</p>
              <div className="mt-auto px-6 py-2 bg-slate-100 rounded-full font-bold text-slate-800 group-hover:bg-brand group-hover:text-white transition-colors">
                Call or Text 988
              </div>
            </a>

            <a 
              href="sms:741741"
              className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 border-slate-200 hover:border-brand/40 transition-colors group"
            >
              <MessageSquare className="h-8 w-8 text-slate-800 mb-4 group-hover:text-brand transition-colors" />
              <h3 className="font-bold text-xl text-slate-800 mb-2">Crisis Text Line</h3>
              <p className="text-slate-500 text-sm mb-4">Text HOME to connect with a volunteer Crisis Counselor 24/7.</p>
              <div className="mt-auto px-6 py-2 bg-slate-100 rounded-full font-bold text-slate-800 group-hover:bg-brand group-hover:text-white transition-colors">
                Text HOME to 741741
              </div>
            </a>

            <a 
              href="tel:18002738255"
              className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 border-slate-200 hover:border-brand/40 transition-colors group"
            >
              <Phone className="h-8 w-8 text-slate-800 mb-4 group-hover:text-brand transition-colors" />
              <h3 className="font-bold text-xl text-slate-800 mb-2">Veterans Crisis Line</h3>
              <p className="text-slate-500 text-sm mb-4">Connect with the Veterans Crisis Line to reach caring, qualified responders.</p>
              <div className="mt-auto px-6 py-2 bg-slate-100 rounded-full font-bold text-slate-800 group-hover:bg-brand group-hover:text-white transition-colors">
                Dial 988, then press 1
              </div>
            </a>

            <a 
              href="tel:18664887386"
              className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 border-slate-200 hover:border-brand/40 transition-colors group"
            >
              <Phone className="h-8 w-8 text-slate-800 mb-4 group-hover:text-brand transition-colors" />
              <h3 className="font-bold text-xl text-slate-800 mb-2">The Trevor Project</h3>
              <p className="text-slate-500 text-sm mb-4">24/7 crisis intervention and suicide prevention for LGBTQ youth.</p>
              <div className="mt-auto px-6 py-2 bg-slate-100 rounded-full font-bold text-slate-800 group-hover:bg-brand group-hover:text-white transition-colors">
                Call 866-488-7386
              </div>
            </a>
          </div>

          <div className="bg-slate-800 rounded-3xl p-8 sm:p-12 text-center">
            <Globe className="h-10 w-10 text-slate-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">International Resources</h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              If you are outside the United States, there are organizations in your country ready to help. Please reach out.
            </p>
            <a 
              href="http://www.suicide.org/international-suicide-hotlines.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-white px-8 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-200 transition-colors"
            >
              Find International Hotlines
            </a>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
