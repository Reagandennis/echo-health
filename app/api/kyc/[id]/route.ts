import { eq } from "drizzle-orm";
import { kycDocuments } from "@/lib/db/schema";
import { withCurrentUser } from "@/lib/db/session";

/**
 * Serves a therapist KYC document (licence, ID) from Postgres.
 *
 * Replaces the Appwrite Storage URL this used to be. That URL was **publicly
 * readable by anyone who had it** — no authentication, no expiry — and it
 * embedded the Appwrite endpoint and project id directly into stored data.
 * These are identity documents, so that was the most sensitive thing in the
 * old storage layer.
 *
 * Authorization is enforced twice, deliberately:
 *  1. `withCurrentUser` throws when unauthenticated.
 *  2. RLS policy `kyc_documents_select` restricts rows to the owning therapist
 *     or an admin — so even a bug in this handler cannot serve someone else's
 *     document. A missing row and a forbidden row are indistinguishable here,
 *     which is intentional: it avoids confirming that a given id exists.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Reject malformed ids before touching the database.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  let doc;
  try {
    doc = await withCurrentUser(async (tx) => {
      const rows = await tx
        .select({
          filename: kycDocuments.filename,
          mimeType: kycDocuments.mimeType,
          content: kycDocuments.content,
        })
        .from(kycDocuments)
        .where(eq(kycDocuments.id, id))
        .limit(1);
      return rows[0];
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!doc) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(doc.content), {
    headers: {
      "Content-Type": doc.mimeType,
      // `attachment` rather than `inline`: these are user-uploaded files, and
      // rendering one in-origin would allow stored XSS via a crafted SVG or HTML.
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.filename)}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      // Identity documents must not sit in shared or browser caches.
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
