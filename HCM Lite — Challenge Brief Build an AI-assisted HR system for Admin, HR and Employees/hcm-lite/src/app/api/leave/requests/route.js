import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import LeaveRequest from '@/models/LeaveRequest';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';

    const query = {};
    if (status) query.status = status;

    // Data Scoping:
    if (user.role === 'employee') {
      const ownEmpId = user.employee_id ? user.employee_id._id || user.employee_id : null;
      if (!ownEmpId) return NextResponse.json({ requests: [] });
      query.employee_id = ownEmpId;
    }

    const requests = await LeaveRequest.find(query)
      .populate('employee_id', 'employee_code first_name last_name email department_id')
      .populate('leave_type_id', 'name code is_paid')
      .populate('reviewed_by', 'email role')
      .sort({ createdAt: -1 });

    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
