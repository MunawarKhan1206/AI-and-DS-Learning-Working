import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Attendance from '@/models/Attendance';
import CompanySettings from '@/models/CompanySettings';
import { evaluateCheckOut, formatDate } from '@/lib/business-rules';
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

    const now = new Date();
    const todayStr = formatDate(now);

    const record = await Attendance.findOne({
      employee_id: employeeId,
      date: todayStr,
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Cannot check out: You have not checked in for today yet' },
        { status: 400 }
      );
    }

    if (record.check_out) {
      return NextResponse.json(
        {
          error: 'You have already checked out for today',
          check_out_time: record.check_out,
        },
        { status: 400 }
      );
    }

    const settings = (await CompanySettings.findOne()) || {
      half_day_hours: 5,
    };

    const workedHours =
      Math.round(((now.getTime() - record.check_in.getTime()) / (1000 * 60 * 60)) * 100) / 100;

    const finalStatus = evaluateCheckOut(
      workedHours,
      record.is_late,
      settings.half_day_hours
    );

    const before = record.toObject();

    record.check_out = now;
    record.worked_hours = workedHours;
    record.status = finalStatus;
    await record.save();

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CHECK_OUT',
      entity: 'Attendance',
      entity_id: String(record._id),
      before,
      after: record.toObject(),
    });

    return NextResponse.json({
      success: true,
      attendance: record,
      message: `Checked out at ${now.toLocaleTimeString()}. Worked ${workedHours} hours. Status: ${finalStatus}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
