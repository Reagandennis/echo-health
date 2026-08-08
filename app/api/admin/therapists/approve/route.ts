import { NextRequest, NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite/clinical'; // Adjust import as needed
import { sendVerificationEmail } from '@/lib/email';
import { isAdmin } from '@/middleware'; // Role-check middleware

// POST: /api/admin/therapists/approve
export async function POST(req: NextRequest) {
  try {
    // Role check (ensure only admins can access)
    const user = await isAdmin(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { therapistId, therapistEmail, therapistName } = await req.json();
    if (!therapistId || !therapistEmail) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Update therapist status to VERIFIED
    await databases.updateDocument(
      'your-database-id',
      'therapists',
      therapistId,
      { verification_status: 'VERIFIED' }
    );

    // Create in-app notification
    await databases.createDocument(
      'your-database-id',
      'in_app_notifications',
      'unique()',
      {
        user_id: therapistId,
        type: 'VERIFICATION',
        message: 'Your account has been verified! You can now access all features.',
        read: false,
        created_at: new Date().toISOString(),
      }
    );

    // Send verification email asynchronously
    sendVerificationEmail({
      to: therapistEmail,
      name: therapistName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
