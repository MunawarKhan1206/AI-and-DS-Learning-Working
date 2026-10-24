import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import LeaveType from '@/models/LeaveType';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const leaveTypes = await LeaveType.find().sort({ name: 1 });
    return NextResponse.json({ leaveTypes });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();

    if (!body.name || !body.code) {
      return NextResponse.json(
        { error: 'Leave type name and code are required' },
        { status: 400 }
      );
    }

    const leaveType = await LeaveType.create({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      quota: Number(body.quota) || 0,
      is_paid: body.is_paid !== false,
      is_active: body.is_active !== false,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CREATE_LEAVE_TYPE',
      entity: 'LeaveType',
      entity_id: String(leaveType._id),
      after: leaveType.toObject(),
    });

    return NextResponse.json({ success: true, leaveType });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();

    if (!body._id) {
      return NextResponse.json(
        { error: 'Leave type ID is required' },
        { status: 400 }
      );
    }

    const leaveType = await LeaveType.findById(body._id);
    if (!leaveType) {
      return NextResponse.json(
        { error: 'Leave type not found' },
        { status: 404 }
      );
    }

    const before = leaveType.toObject();

    if (body.name !== undefined) leaveType.name = body.name.trim();
    if (body.quota !== undefined) leaveType.quota = Number(body.quota);
    if (body.is_paid !== undefined) leaveType.is_paid = body.is_paid;
    if (body.is_active !== undefined) leaveType.is_active = body.is_active;

    await leaveType.save();

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'UPDATE_LEAVE_TYPE',
      entity: 'LeaveType',
      entity_id: String(leaveType._id),
      before,
      after: leaveType.toObject(),
    });

    return NextResponse.json({ success: true, leaveType });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
