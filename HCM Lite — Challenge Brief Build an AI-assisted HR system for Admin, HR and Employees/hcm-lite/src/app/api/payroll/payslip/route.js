import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Payroll from '@/models/Payroll';
import CompanySettings from '@/models/CompanySettings';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const payrollId = searchParams.get('id');

    if (!payrollId) {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 });
    }

    await connectDB();
    const record = await Payroll.findById(payrollId).populate({
      path: 'employee_id',
      populate: [
        { path: 'department_id', select: 'name code' },
        { path: 'designation_id', select: 'title' },
      ],
    });

    if (!record) {
      return NextResponse.json({ error: 'Payslip record not found' }, { status: 404 });
    }

    // SERVER-SIDE PERMISSION SCOPE CHECK:
    // If user is employee, verify they own this record and that it's finalized
    if (user.role === 'employee') {
      const ownEmpId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
      if (String(record.employee_id._id) !== ownEmpId) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to access another employee’s payslip' },
          { status: 403 }
        );
      }
      if (record.status !== 'finalized') {
        return NextResponse.json(
          { error: 'Forbidden: Payslip is still in draft state and has not been finalized by Admin' },
          { status: 403 }
        );
      }
    }

    const settings = await CompanySettings.findOne();

    return NextResponse.json({
      payslip: record,
      company: settings || { company_name: 'HCM Lite' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
