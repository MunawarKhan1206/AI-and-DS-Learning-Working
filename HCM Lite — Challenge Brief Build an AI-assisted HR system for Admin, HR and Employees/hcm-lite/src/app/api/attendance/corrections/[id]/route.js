import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import AttendanceCorrection from '@/models/AttendanceCorrection';
import Attendance from '@/models/Attendance';
import Notification from '@/models/Notification';
import CompanySettings from '@/models/CompanySettings';
import User from '@/models/User';
import { evaluateCheckIn, evaluateCheckOut } from '@/lib/business-rules';
import { createAuditLog } from '@/lib/audit';

export async function PUT(req, { params }) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const body = await req.json();
    const { status, review_comment } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    await connectDB();
    const correction = await AttendanceCorrection.findById(id).populate('employee_id');
    if (!correction) {
      return NextResponse.json({ error: 'Correction request not found' }, { status: 404 });
    }

    if (correction.status !== 'pending') {
      return NextResponse.json(
        { error: `This correction has already been ${correction.status}` },
        { status: 400 }
      );
    }

    const before = correction.toObject();

    correction.status = status;
    correction.reviewed_by = user._id;
    correction.review_comment = review_comment || '';
    await correction.save();

    // If approved, update or insert the attendance record
    if (status === 'approved') {
      const settings = (await CompanySettings.findOne()) || {
        office_start: '09:00',
        grace_minutes: 15,
        half_day_hours: 5,
      };

      const checkInDate = new Date(correction.proposed_check_in);
      const { isLate, lateMinutes } = evaluateCheckIn(
        checkInDate,
        settings.office_start,
        settings.grace_minutes
      );

      let workedHours = 0;
      let finalStatus = isLate ? 'late' : 'present';

      if (correction.proposed_check_out) {
        const checkOutDate = new Date(correction.proposed_check_out);
        workedHours =
          Math.round(((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)) * 100) /
          100;
        finalStatus = evaluateCheckOut(workedHours, isLate, settings.half_day_hours);
      }

      await Attendance.findOneAndUpdate(
        {
          employee_id: correction.employee_id._id,
          date: correction.date,
        },
        {
          employee_id: correction.employee_id._id,
          date: correction.date,
          check_in: checkInDate,
          check_out: correction.proposed_check_out ? new Date(correction.proposed_check_out) : null,
          worked_hours: workedHours,
          is_late: isLate,
          late_minutes: lateMinutes,
          status: finalStatus,
          remarks: `Corrected by ${user.role} (${user.email}): ${review_comment || 'Approved'}`,
        },
        { upsert: true, new: true }
      );
    }

    // Send notification to employee
    const targetUser = await User.findOne({ employee_id: correction.employee_id._id });
    if (targetUser) {
      await Notification.create({
        user_id: targetUser._id,
        title: `Attendance Correction ${status.toUpperCase()}`,
        message: `Your correction request for ${correction.date} was ${status}.${review_comment ? ' Comment: ' + review_comment : ''}`,
        type: 'attendance',
      });
    }

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: `ATTENDANCE_CORRECTION_${status.toUpperCase()}`,
      entity: 'AttendanceCorrection',
      entity_id: String(correction._id),
      before,
      after: correction.toObject(),
    });

    return NextResponse.json({
      success: true,
      correction,
      message: `Correction request ${status}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
