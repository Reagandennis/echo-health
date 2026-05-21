import { ArrowLeft, MessageCircle, Building2, Stethoscope, Mail } from "lucide-react";
import Link from "next/link";
import Footer from "../components/Footer";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact Echo Health",
  description:
    "Reach our support, clinical, partnerships, and press teams. We respond to every message within one business day.",
  path: "/contact",
});

const contacts = [
  {
    icon: MessageCircle,
    title: "Customer Support",
    description: "Need help with your account, billing, or technical issues? Our support team is here to help.",
    email: "support@echohealth.app",
    color: "bg-teal-100 text-teal-700",
  },
  {
    icon: Building2,
    title: "Enterprise Sales",
    description: "Interested in bringing Echo Health to your organization? Talk to our B2B team.",
    email: "sales@echohealth.app",
    color: "bg-brand/10 text-brand",
  },
  {
    icon: Stethoscope,
    title: "Provider Support",
    description: "Are you a therapist on our platform? Reach out to our clinical operations team.",
    email: "providers@echohealth.app",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    icon: Mail,
    title: "Press & Partnerships",
    description: "For media inquiries, expert commentary, or partnership opportunities.",
    email: "press@echohealth.app",
    color: "bg-slate-100 text-slate-700",
  },
];

export default function ContactPage() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-slate-50 min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-24">
        <div className="mx-auto max-w-5xl text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 tracking-tight mb-6">
            Get in touch
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Whether you have a question about features, pricing, or anything else, our team is ready to answer all your questions.
          </p>
        </div>

        <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-8">
          {contacts.map((contact) => (
            <div key={contact.title} className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${contact.color}`}>
                <contact.icon size={24} strokeWidth={2} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-3">{contact.title}</h2>
              <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-8">
                {contact.description}
              </p>
              <a 
                href={`mailto:${contact.email}`}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200 transition-colors mt-auto"
              >
                {contact.email}
              </a>
            </div>
          ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
