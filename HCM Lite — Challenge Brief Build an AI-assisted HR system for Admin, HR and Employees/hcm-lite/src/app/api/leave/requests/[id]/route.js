import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import LeaveRequest from '@/models/LeaveRequest';
import Notification from '@/models/Notification';
import User from '@/models/User';
import { createAuditLog } from '@/lib/audit';

export async function PUT(req, { params }) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const body = await req.json();
    const { action, review_comment } = body;

    await connectDB();
    const leaveRequest = await LeaveRequest.findById(id).populate('employee_id');
    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    const before = leaveRequest.toObject();

    // Employee cancellation flow
    if (action === 'cancel') {
      const ownEmpId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
      if (String(leaveRequest.employee_id._id) !== ownEmpId && user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: You can only cancel your own leave requests' },
          { status: 403 }
        );
      }

      if (['rejected', 'cancelled'].includes(leaveRequest.status)) {
        return NextResponse.json(
          { error: `Cannot cancel a leave request that is already ${leaveRequest.status}` },
          { status: 400 }
        );
      }

      leaveRequest.status = 'cancelled';
      leaveRequest.cancelled_at = new Date();
      await leaveRequest.save();

      await createAuditLog({
        actor: { _id: user._id, email: user.email, role: user.role },
        action: 'CANCEL_LEAVE',
        entity: 'LeaveRequest',
        entity_id: String(leaveRequest._id),
        before,
        after: leaveRequest.toObject(),
      });

      return NextResponse.json({
        success: true,
        message: 'Leave request has been cancelled',
      });
    }

    // HR / Admin Approval or Rejection flow
    if (action === 'approve' || action === 'reject') {
      if (user.role !== 'admin' && user.role !== 'hr') {
        return NextResponse.json(
          { error: 'Forbidden: Only HR or Admin can approve or reject leave requests' },
          { status: 403 }
        );
      }

      if (leaveRequest.status !== 'pending') {
        return NextResponse.json(
          { error: `This leave request is already ${leaveRequest.status}` },
          { status: 400 }
        );
      }

      const finalStatus = action === 'approve' ? 'approved' : 'rejected';
      leaveRequest.status = finalStatus;
      leaveRequest.reviewed_by = user._id;
      leaveRequest.review_comment = review_comment || '';
      await leaveRequest.save();

      // Send notification to employee
      const targetUser = await User.findOne({ employee_id: leaveRequest.employee_id._id });
      if (targetUser) {
        await Notification.create({
          user_id: targetUser._id,
          title: `Leave Request ${finalStatus.toUpperCase()}`,
          message: `Your leave request for ${leaveRequest.start_date} to ${leaveRequest.end_date} was ${finalStatus}.${review_comment ? ' Comment: ' + review_comment : ''}`,
          type: 'leave',
        });
      }

      await createAuditLog({
        actor: { _id: user._id, email: user.email, role: user.role },
        action: `LEAVE_${finalStatus.toUpperCase()}`,
        entity: 'LeaveRequest',
        entity_id: String(leaveRequest._id),
        before,
        after: leaveRequest.toObject(),
      });

      return NextResponse.json({
        success: true,
        leaveRequest,
        message: `Leave request has been ${finalStatus}`,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: 'approve', 'reject', 'cancel'" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
