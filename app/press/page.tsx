import { ArrowLeft, Download, ExternalLink, Mail } from "lucide-react";
import Footer from "../components/Footer";

const releases = [
  {
    date: "Oct 24, 2023",
    title: "Echo Health Announces $15M Series A to Expand Access to Therapy",
    publisher: "Echo Health Press Room",
  },
  {
    date: "Sep 12, 2023",
    title: "Echo Health Launches 'Echo Health for Business' Enterprise Solution",
    publisher: "Echo Health Press Room",
  },
  {
    date: "Jul 08, 2023",
    title: "How Echo Health is Solving the Therapy Waitlist Crisis",
    publisher: "TechCrunch",
  },
  {
    date: "May 15, 2023",
    title: "The Top 10 Digital Health Startups to Watch in 2023",
    publisher: "Forbes",
  },
];

export default function PressPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-slate-50 min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </a>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {/* Hero */}
        <section className="bg-slate-900 text-white px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
              Press & Media
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
              The latest news, announcements, and resources from the Echo Health team.
            </p>
            <a href="mailto:press@echohealth.app" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-md hover:bg-slate-100 transition-colors">
              <Mail size={16} /> Contact Press Team
            </a>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-200 pb-4">Recent News</h2>
            <div className="flex flex-col gap-6">
              {releases.map((release) => (
                <div key={release.title} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-brand/40 transition-colors group">
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                    <span>{release.date}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-brand">{release.publisher}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-4 group-hover:text-brand transition-colors">
                    {release.title}
                  </h3>
                  <a href="#" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:opacity-80 transition-opacity">
                    Read Article <ExternalLink size={14} className="mt-0.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Media Kit</h3>
              <p className="text-sm text-slate-500 mb-6">
                Download our official logos, brand guidelines, and leadership headshots.
              </p>
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
                <Download size={16} /> Download ZIP (12MB)
              </button>
            </div>

            <div className="bg-cream/50 p-8 rounded-3xl border border-cream">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Media Inquiries</h3>
              <p className="text-sm text-slate-500 mb-4">
                For interview requests, expert commentary, or other media inquiries, please contact our PR team.
              </p>
              <a href="mailto:press@echohealth.app" className="text-brand font-semibold text-sm hover:underline">
                press@echohealth.app
              </a>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
