import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import LeaveRequest from '@/models/LeaveRequest';
import LeaveType from '@/models/LeaveType';
import CompanySettings from '@/models/CompanySettings';
import Holiday from '@/models/Holiday';
import { calculateWorkingDays } from '@/lib/business-rules';
import { createAuditLog } from '@/lib/audit';

const LeaveApplySchema = z.object({
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  reason: z.string().min(3, 'A clear reason is required'),
});

export async function POST(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    if (!user.employee_id) {
      return NextResponse.json(
        { error: 'No employee record linked to user account' },
        { status: 400 }
      );
    }

    const employeeId = user.employee_id._id || user.employee_id;
    await connectDB();

    const body = await req.json();
    const validated = LeaveApplySchema.parse(body);

    if (validated.end_date < validated.start_date) {
      return NextResponse.json(
        { error: 'End date cannot be earlier than start date' },
        { status: 400 }
      );
    }

    const leaveType = await LeaveType.findById(validated.leave_type_id);
    if (!leaveType || !leaveType.is_active) {
      return NextResponse.json({ error: 'Invalid or inactive leave type' }, { status: 400 });
    }

    // 1. TRAP CHECK: Overlapping Leave Check => HTTP 422
    const overlapping = await LeaveRequest.findOne({
      employee_id: employeeId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          start_date: { $lte: validated.end_date },
          end_date: { $gte: validated.start_date },
        },
      ],
    });

    if (overlapping) {
      return NextResponse.json(
        {
          error: `Overlapping leave request found from ${overlapping.start_date} to ${overlapping.end_date} (Status: ${overlapping.status})`,
        },
        { status: 422 } // Strict 422 per hackathon specification
      );
    }

    // 2. Compute Working Days (skipping configured weekends and public holidays)
    const settings = (await CompanySettings.findOne()) || { weekend_days: [0, 6] };
    const holidays = await Holiday.find({
      date: { $gte: validated.start_date, $lte: validated.end_date },
    });
    const holidayDates = holidays.map((h) => h.date);

    const workingDays = calculateWorkingDays(
      validated.start_date,
      validated.end_date,
      settings.weekend_days,
      holidayDates
    );

    if (workingDays === 0) {
      return NextResponse.json(
        {
          error: 'The selected date range falls entirely on weekends or public holidays (0 working days)',
        },
        { status: 400 }
      );
    }

    // 3. TRAP CHECK: Over-Balance Check => HTTP 422
    // If not unlimited/unpaid, check remaining balance
    if (leaveType.quota < 999) {
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const approvedThisYear = await LeaveRequest.find({
        employee_id: employeeId,
        leave_type_id: leaveType._id,
        status: 'approved',
        start_date: { $gte: yearStart, $lte: yearEnd },
      });

      const usedDays = approvedThisYear.reduce((acc, l) => acc + (l.working_days || 0), 0);
      const remainingQuota = Math.max(0, leaveType.quota - usedDays);

      if (workingDays > remainingQuota) {
        return NextResponse.json(
          {
            error: `Insufficient leave balance: Requested ${workingDays} working days, but remaining balance is only ${remainingQuota} days (Quota: ${leaveType.quota}, Used: ${usedDays})`,
            requested_days: workingDays,
            remaining_balance: remainingQuota,
            quota: leaveType.quota,
          },
          { status: 422 } // Strict 422 per hackathon specification
        );
      }
    }

    const leaveRequest = await LeaveRequest.create({
      employee_id: employeeId,
      leave_type_id: leaveType._id,
      start_date: validated.start_date,
      end_date: validated.end_date,
      working_days: workingDays,
      reason: validated.reason.trim(),
      status: 'pending',
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'APPLY_LEAVE',
      entity: 'LeaveRequest',
      entity_id: String(leaveRequest._id),
      after: leaveRequest.toObject(),
    });

    return NextResponse.json({
      success: true,
      leaveRequest,
      message: `Leave application for ${workingDays} working day(s) submitted successfully`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
