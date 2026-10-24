import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import CompanySettings from '@/models/CompanySettings';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const settings = await CompanySettings.findOne();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    // Only Admin can modify company settings
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();

    let settings = await CompanySettings.findOne();
    const before = settings ? settings.toObject() : null;

    if (!settings) {
      settings = new CompanySettings(body);
    } else {
      if (body.company_name !== undefined) settings.company_name = body.company_name;
      if (body.office_start !== undefined) settings.office_start = body.office_start;
      if (body.grace_minutes !== undefined) settings.grace_minutes = Number(body.grace_minutes);
      if (body.half_day_hours !== undefined) settings.half_day_hours = Number(body.half_day_hours);
      if (body.weekend_days !== undefined) settings.weekend_days = body.weekend_days;
      if (body.office_lat !== undefined) settings.office_lat = body.office_lat;
      if (body.office_lng !== undefined) settings.office_lng = body.office_lng;
      if (body.office_radius_meters !== undefined)
        settings.office_radius_meters = Number(body.office_radius_meters);
    }

    await settings.save();

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'UPDATE_COMPANY_SETTINGS',
      entity: 'CompanySettings',
      entity_id: String(settings._id),
      before,
      after: settings.toObject(),
    });

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
