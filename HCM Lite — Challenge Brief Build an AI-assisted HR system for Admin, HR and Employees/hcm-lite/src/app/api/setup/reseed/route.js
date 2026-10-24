/**
 * POST /api/setup/reseed
 *
 * Development / demo helper – drops all non-user collections and runs the full
 * comprehensive seed from init-admin.js so judges and testers can start fresh.
 *
 * Only callable when NODE_ENV !== 'production'  OR  the RESEED_SECRET header matches.
 */
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET(req) {
  return POST(req);
}

export async function POST(req) {
  try {
    const secret = req.headers.get('x-reseed-secret');
    const allowedSecret = process.env.RESEED_SECRET || 'hcmlite-reseed';

    if (process.env.NODE_ENV === 'production' && secret !== allowedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    // Dynamically import models (ensures schemas are registered)
    const [
      Attendance,
      AttendanceCorrection,
      LeaveRequest,
      Payroll,
      Announcement,
      Holiday,
    ] = await Promise.all([
      import('@/models/Attendance').then(m => m.default),
      import('@/models/AttendanceCorrection').then(m => m.default),
      import('@/models/LeaveRequest').then(m => m.default),
      import('@/models/Payroll').then(m => m.default),
      import('@/models/Announcement').then(m => m.default),
      import('@/models/Holiday').then(m => m.default),
    ]);

    // Clear transactional / demo data (keep users so login still works)
    await Promise.all([
      Attendance.deleteMany({}),
      AttendanceCorrection.deleteMany({}),
      LeaveRequest.deleteMany({}),
      Payroll.deleteMany({}),
      Announcement.deleteMany({}),
      Holiday.deleteMany({}),
    ]);

    // Re-run full seed
    const { ensureDefaultAdmin } = await import('@/lib/init-admin');
    await ensureDefaultAdmin();

    return NextResponse.json({
      success: true,
      message: 'Database reseeded with comprehensive HCM Lite demo data.',
    });
  } catch (err) {
    console.error('[reseed]', err);
    return NextResponse.json(
      { error: 'Reseed failed', details: err.message },
      { status: 500 }
    );
  }
}
