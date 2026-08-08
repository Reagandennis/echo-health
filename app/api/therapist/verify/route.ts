import { NextRequest, NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite/clinical'; // Adjust import as needed

// POST: /api/therapist/verify
export async function POST(req: NextRequest) {
  try {
    const { therapistId, documentUrls } = await req.json();
    if (!therapistId || !Array.isArray(documentUrls)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Update therapist document in Appwrite
    // Replace 'therapists' and 'your-database-id' with actual values
    await databases.updateDocument(
      'your-database-id',
      'therapists',
      therapistId,
      {
        verification_status: 'PENDING',
        document_urls: documentUrls,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
