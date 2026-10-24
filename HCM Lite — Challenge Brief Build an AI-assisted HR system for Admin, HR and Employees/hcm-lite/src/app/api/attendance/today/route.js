import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Attendance from '@/models/Attendance';
import { formatDate } from '@/lib/business-rules';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    if (!user.employee_id) {
      return NextResponse.json({ attendance: null });
    }

    const employeeId = user.employee_id._id || user.employee_id;
    await connectDB();

    const todayStr = formatDate(new Date());
    const attendance = await Attendance.findOne({
      employee_id: employeeId,
      date: todayStr,
    });

    return NextResponse.json({ attendance });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
