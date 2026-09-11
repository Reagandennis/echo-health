import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/auth/session";
import TherapistShell from "./_components/TherapistShell";

export default async function TherapistLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await getLoggedInUser();

  if (!user) {
    redirect("/signin");
  }

  const labels: string[] = user.labels ?? [];
  if (!labels.includes("therapist") && !labels.includes("admin")) {
    redirect("/dashboard");
  }

  return <TherapistShell user={user}>{children}</TherapistShell>;
}
