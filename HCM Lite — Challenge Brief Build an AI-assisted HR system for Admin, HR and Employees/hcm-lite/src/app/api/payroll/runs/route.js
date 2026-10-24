import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Payroll from '@/models/Payroll';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || '';

    // Data Scoping:
    if (user.role === 'employee') {
      const ownEmpId = user.employee_id ? user.employee_id._id || user.employee_id : null;
      if (!ownEmpId) return NextResponse.json({ records: [] });

      const empQuery = { employee_id: ownEmpId, status: 'finalized' };
      if (month) empQuery.month = month;

      const records = await Payroll.find(empQuery)
        .populate('employee_id', 'employee_code first_name last_name email department_id')
        .sort({ month: -1 });

      return NextResponse.json({ records });
    }

    // HR and Admin:
    const query = {};
    if (month) query.month = month;

    const records = await Payroll.find(query)
      .populate({
        path: 'employee_id',
        select: 'employee_code first_name last_name email department_id',
        populate: { path: 'department_id', select: 'name code' },
      })
      .sort({ month: -1, createdAt: -1 });

    // Distinct months
    const availableMonths = await Payroll.distinct('month');

    const totalGross = records.reduce((acc, r) => acc + (r.gross_salary || 0), 0);
    const totalNet = records.reduce((acc, r) => acc + (r.net_salary || 0), 0);
    const totalTax = records.reduce((acc, r) => acc + (r.tax_deduction || 0), 0);
    const totalDeductions = records.reduce((acc, r) => acc + (r.absence_deduction || 0), 0);
    const isFinalized = records.length > 0 && records.every((r) => r.status === 'finalized');

    return NextResponse.json({
      month,
      availableMonths: availableMonths.sort().reverse(),
      isFinalized,
      summary: {
        totalEmployees: records.length,
        totalGross,
        totalNet,
        totalTax,
        totalDeductions,
      },
      records,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
