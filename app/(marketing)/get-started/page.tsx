import IntakeQuiz from "@/app/components/marketing/IntakeQuiz";
import { pageMetadata } from "@/lib/seo";

/**
 * The intake funnel's entry point.
 *
 * `/get-started` is the URL every CTA on the site points at. It is indexable
 * on purpose — "start online therapy" is a real query and this is the page
 * that answers it — but it carries no marketing copy above the first question:
 * anything between the click and question one is a place to leave.
 *
 * The page itself is a Server Component with static metadata; only the quiz
 * beneath it hydrates.
 */
export const metadata = pageMetadata({
  title: "Get started — find your therapist",
  description:
    "Answer a few questions about what you're looking for and we'll match you with a licensed therapist. Takes about three minutes, and nothing is shared until you create an account.",
  path: "/get-started",
});

export default function GetStartedPage() {
  return <IntakeQuiz />;
}
