import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import { createAuditLog } from '@/lib/audit';

const CorrectionRequestSchema = z.object({
  attendance_id: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  proposed_check_in: z.string().min(1, 'Proposed check-in timestamp is required'),
  proposed_check_out: z.string().optional().nullable(),
  reason: z.string().min(3, 'A clear reason is required'),
});

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const query = {};

    // Data Scoping: Employees only see their own correction requests
    if (user.role === 'employee') {
      const ownEmpId = user.employee_id ? user.employee_id._id || user.employee_id : null;
      if (!ownEmpId) return NextResponse.json({ corrections: [] });
      query.employee_id = ownEmpId;
    }

    const corrections = await AttendanceCorrection.find(query)
      .populate('employee_id', 'employee_code first_name last_name email')
      .populate('reviewed_by', 'email role')
      .sort({ createdAt: -1 });

    return NextResponse.json({ corrections });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['employee', 'hr', 'admin']);
    if (errorResponse) return errorResponse;

    if (!user.employee_id) {
      return NextResponse.json(
        { error: 'No employee record linked to user' },
        { status: 400 }
      );
    }

    const employeeId = user.employee_id._id || user.employee_id;
    await connectDB();

    const body = await req.json();
    const validated = CorrectionRequestSchema.parse(body);

    const correction = await AttendanceCorrection.create({
      employee_id: employeeId,
      attendance_id: validated.attendance_id || null,
      date: validated.date,
      proposed_check_in: new Date(validated.proposed_check_in),
      proposed_check_out: validated.proposed_check_out ? new Date(validated.proposed_check_out) : null,
      reason: validated.reason.trim(),
      status: 'pending',
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'REQUEST_ATTENDANCE_CORRECTION',
      entity: 'AttendanceCorrection',
      entity_id: String(correction._id),
      after: correction.toObject(),
    });

    return NextResponse.json({
      success: true,
      correction,
      message: 'Correction request submitted for HR review',
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
