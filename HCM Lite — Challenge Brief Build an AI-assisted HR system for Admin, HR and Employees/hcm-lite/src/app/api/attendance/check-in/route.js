import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Attendance from '@/models/Attendance';
import CompanySettings from '@/models/CompanySettings';
import { evaluateCheckIn, formatDate, getDistanceMeters } from '@/lib/business-rules';
import { createAuditLog } from '@/lib/audit';

export async function POST(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['employee', 'hr', 'admin']);
    if (errorResponse) return errorResponse;

    if (!user.employee_id) {
      return NextResponse.json(
        { error: 'No employee profile linked to this user account' },
        { status: 400 }
      );
    }

    const employeeId = user.employee_id._id || user.employee_id;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const { lat, lng } = body;

    // Server-stamped time & date (never rely on client time!)
    const now = new Date();
    const todayStr = formatDate(now);

    // Trap check: Second check-in on the same day => HTTP 409
    const existing = await Attendance.findOne({
      employee_id: employeeId,
      date: todayStr,
    });

    if (existing) {
      return NextResponse.json(
        {
          error: 'You have already checked in for today',
          date: todayStr,
          check_in_time: existing.check_in,
        },
        { status: 409 } // 409 Conflict per spec
      );
    }

    // Get company settings for office hours & geofence
    const settings = (await CompanySettings.findOne()) || {
      office_start: '09:00',
      grace_minutes: 15,
      office_radius_meters: 150,
    };

    // Geofencing verification if office lat/lng is configured
    if (settings.office_lat && settings.office_lng && lat && lng) {
      const distance = getDistanceMeters(
        settings.office_lat,
        settings.office_lng,
        Number(lat),
        Number(lng)
      );
      if (distance > settings.office_radius_meters) {
        return NextResponse.json(
          {
            error: `Check-in rejected: You are ${Math.round(distance)}m away from the office (limit: ${settings.office_radius_meters}m)`,
          },
          { status: 403 }
        );
      }
    }

    const { isLate, lateMinutes, status } = evaluateCheckIn(
      now,
      settings.office_start,
      settings.grace_minutes
    );

    const record = await Attendance.create({
      employee_id: employeeId,
      date: todayStr,
      check_in: now,
      is_late: isLate,
      late_minutes: lateMinutes,
      status, // 'late' or 'present'
      check_in_lat: lat || null,
      check_in_lng: lng || null,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CHECK_IN',
      entity: 'Attendance',
      entity_id: String(record._id),
      after: { date: todayStr, check_in: now, status },
    });

    return NextResponse.json({
      success: true,
      attendance: record,
      message: isLate
        ? `Checked in late at ${now.toLocaleTimeString()} (${lateMinutes} mins late)`
        : `Checked in on time at ${now.toLocaleTimeString()}`,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Mongo unique compound index duplicate check
      return NextResponse.json(
        { error: 'You have already checked in for today' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
