import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import LeaveType from '@/models/LeaveType';
import LeaveRequest from '@/models/LeaveRequest';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    let targetEmployeeId = searchParams.get('employee_id');

    // Data Scoping:
    if (user.role === 'employee') {
      targetEmployeeId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
    } else if (!targetEmployeeId && user.employee_id) {
      targetEmployeeId = String(user.employee_id._id || user.employee_id);
    }

    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    await connectDB();

    const leaveTypes = await LeaveType.find({ is_active: true });
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const balances = await Promise.all(
      leaveTypes.map(async (lt) => {
        // Find approved leaves this year
        const approvedLeaves = await LeaveRequest.find({
          employee_id: targetEmployeeId,
          leave_type_id: lt._id,
          status: 'approved',
          start_date: { $gte: yearStart, $lte: yearEnd },
        });

        const pendingLeaves = await LeaveRequest.find({
          employee_id: targetEmployeeId,
          leave_type_id: lt._id,
          status: 'pending',
          start_date: { $gte: yearStart, $lte: yearEnd },
        });

        const usedDays = approvedLeaves.reduce((acc, l) => acc + (l.working_days || 0), 0);
        const pendingDays = pendingLeaves.reduce((acc, l) => acc + (l.working_days || 0), 0);
        const remaining = lt.quota >= 999 ? 999 : Math.max(0, lt.quota - usedDays);

        return {
          leave_type_id: lt._id,
          name: lt.name,
          code: lt.code,
          quota: lt.quota,
          is_paid: lt.is_paid,
          used: usedDays,
          pending: pendingDays,
          remaining: lt.quota >= 999 ? 'Unlimited' : remaining,
        };
      })
    );

    return NextResponse.json({ balances });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
