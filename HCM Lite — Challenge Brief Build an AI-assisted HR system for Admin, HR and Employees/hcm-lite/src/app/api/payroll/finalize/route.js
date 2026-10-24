import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Payroll from '@/models/Payroll';
import Notification from '@/models/Notification';
import User from '@/models/User';
import { createAuditLog } from '@/lib/audit';

export async function POST(req) {
  try {
    // STRICT RULE: Only Admin can finalize payroll!
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const { month } = body;

    if (!month) {
      return NextResponse.json({ error: 'Month is required' }, { status: 400 });
    }

    const draftRecords = await Payroll.find({ month, status: 'draft' });
    if (draftRecords.length === 0) {
      const alreadyFinalized = await Payroll.countDocuments({ month, status: 'finalized' });
      if (alreadyFinalized > 0) {
        return NextResponse.json(
          { error: `Payroll for ${month} is already finalized and locked` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `No draft payroll found for ${month}. Please generate a draft first.` },
        { status: 404 }
      );
    }

    const now = new Date();

    // Lock and finalize all records for this month
    await Payroll.updateMany(
      { month, status: 'draft' },
      {
        $set: {
          status: 'finalized',
          finalized_by: user._id,
          finalized_at: now,
        },
      }
    );

    // Notify employees
    for (const record of draftRecords) {
      const empUser = await User.findOne({ employee_id: record.employee_id });
      if (empUser) {
        await Notification.create({
          user_id: empUser._id,
          title: 'Payslip Released',
          message: `Your payslip for ${month} has been finalized. Net Salary: $${record.net_salary.toLocaleString()}`,
          type: 'payroll',
        });
      }
    }

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: 'admin' },
      action: 'FINALIZE_PAYROLL',
      entity: 'Payroll',
      after: { month, finalizedCount: draftRecords.length, finalizedAt: now },
    });

    return NextResponse.json({
      success: true,
      month,
      finalizedCount: draftRecords.length,
      message: `Payroll for ${month} finalized and locked successfully`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
