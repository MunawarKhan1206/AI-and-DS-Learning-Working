import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Attendance from '@/models/Attendance';
import LeaveRequest from '@/models/LeaveRequest';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7); // "YYYY-MM"
    let targetEmployeeId = searchParams.get('employee_id');

    // Data Scoping:
    if (user.role === 'employee') {
      targetEmployeeId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
    } else if (!targetEmployeeId && user.employee_id) {
      targetEmployeeId = String(user.employee_id._id || user.employee_id);
    }

    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Query records starting with month prefix "YYYY-MM"
    const attendanceRecords = await Attendance.find({
      employee_id: targetEmployeeId,
      date: { $regex: `^${month}` },
    }).sort({ date: 1 });

    const leaves = await LeaveRequest.find({
      employee_id: targetEmployeeId,
      status: 'approved',
      $or: [
        { start_date: { $regex: `^${month}` } },
        { end_date: { $regex: `^${month}` } },
      ],
    }).populate('leave_type_id', 'name code');

    // Compute weekly hours for current week
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    const thisWeekRecords = await Attendance.find({
      employee_id: targetEmployeeId,
      date: { $gte: startOfWeekStr, $lte: endOfWeekStr },
    });

    const hoursThisWeek = thisWeekRecords.reduce(
      (acc, r) => acc + (r.worked_hours || 0),
      0
    );
    const lateCount = attendanceRecords.filter((r) => r.is_late).length;
    const halfDayCount = attendanceRecords.filter((r) => r.status === 'half_day').length;

    return NextResponse.json({
      month,
      employee_id: targetEmployeeId,
      records: attendanceRecords,
      approved_leaves: leaves,
      summary: {
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        targetHoursWeek: 40,
        lateCount,
        halfDayCount,
        totalPresentDays: attendanceRecords.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
