import { eq } from "drizzle-orm";
import { avatars } from "@/lib/db/schema";
import { withAnonymous } from "@/lib/db/session";

/**
 * Serves a profile photo.
 *
 * Deliberately unauthenticated, unlike `/api/kyc/[id]`: avatars appear in the
 * public therapist directory that visitors browse before signing in. The
 * `avatars_select` RLS policy is `USING (true)` for the same reason. Nothing
 * sensitive is reachable here — identity documents live in `kyc_documents`,
 * behind a policy restricted to their owner and admins.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const row = await withAnonymous(async (tx) => {
    const rows = await tx
      .select({
        mimeType: avatars.mimeType,
        content: avatars.content,
      })
      .from(avatars)
      .where(eq(avatars.id, id))
      .limit(1);
    return rows[0];
  });

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": row.mimeType,
      // Uploads are user-controlled bytes. Even with the upload-time MIME
      // allowlist, refuse to let the browser sniff a different type or execute
      // anything embedded in the file.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // Immutable: a new upload mints a new row and therefore a new URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
