import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Attendance from '@/models/Attendance';
import LeaveRequest from '@/models/LeaveRequest';
import LeaveType from '@/models/LeaveType';
import Payroll from '@/models/Payroll';
import Announcement from '@/models/Announcement';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['employee', 'hr', 'admin']);
    if (errorResponse) return errorResponse;

    if (!user.employee_id) {
      return NextResponse.json({ error: 'No employee record linked' }, { status: 400 });
    }

    const employeeId = user.employee_id._id || user.employee_id;
    await connectDB();

    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);

    // 1. Hours this week vs 40h
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekRecords = await Attendance.find({
      employee_id: employeeId,
      date: {
        $gte: startOfWeek.toISOString().split('T')[0],
        $lte: endOfWeek.toISOString().split('T')[0],
      },
    });

    const hoursThisWeek = Math.round(
      weekRecords.reduce((acc, r) => acc + (r.worked_hours || 0), 0) * 10
    ) / 10;

    // 2. Late count this month
    const lateCountMonth = await Attendance.countDocuments({
      employee_id: employeeId,
      date: { $regex: `^${currentMonth}` },
      is_late: true,
    });

    // 3. Leave Balances
    const leaveTypes = await LeaveType.find({ is_active: true });
    const yearStart = `${now.getFullYear()}-01-01`;
    const yearEnd = `${now.getFullYear()}-12-31`;

    const balances = await Promise.all(
      leaveTypes.map(async (lt) => {
        const approved = await LeaveRequest.find({
          employee_id: employeeId,
          leave_type_id: lt._id,
          status: 'approved',
          start_date: { $gte: yearStart, $lte: yearEnd },
        });
        const used = approved.reduce((acc, l) => acc + (l.working_days || 0), 0);
        return {
          name: lt.name,
          code: lt.code,
          quota: lt.quota,
          used,
          remaining: lt.quota >= 999 ? 'Unlimited' : Math.max(0, lt.quota - used),
        };
      })
    );

    // 4. Last finalized payslip
    const lastPayslip = await Payroll.findOne({
      employee_id: employeeId,
      status: 'finalized',
    }).sort({ month: -1 });

    // 5. Recent announcements
    const announcements = await Announcement.find({
      $or: [{ target_role: 'all' }, { target_role: 'employee' }],
    })
      .sort({ createdAt: -1 })
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        hoursThisWeek,
        targetHoursWeek: 40,
        lateCountMonth,
        balances,
        lastPayslip: lastPayslip
          ? {
              _id: lastPayslip._id,
              month: lastPayslip.month,
              gross_salary: lastPayslip.gross_salary,
              net_salary: lastPayslip.net_salary,
              tax_deduction: lastPayslip.tax_deduction,
              absence_deduction: lastPayslip.absence_deduction,
            }
          : null,
        announcements,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
