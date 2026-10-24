import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Holiday from '@/models/Holiday';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const holidays = await Holiday.find().sort({ date: 1 });
    return NextResponse.json({ holidays });
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

    if (!body.name || !body.date) {
      return NextResponse.json(
        { error: 'Holiday name and date (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }

    const existing = await Holiday.findOne({ date: body.date });
    if (existing) {
      return NextResponse.json(
        { error: 'A holiday for this date already exists' },
        { status: 400 }
      );
    }

    const holiday = await Holiday.create({
      name: body.name.trim(),
      date: body.date,
      description: body.description || '',
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CREATE_HOLIDAY',
      entity: 'Holiday',
      entity_id: String(holiday._id),
      after: holiday.toObject(),
    });

    return NextResponse.json({ success: true, holiday });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID is required' }, { status: 400 });
    }

    await connectDB();
    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    const before = holiday.toObject();
    await Holiday.findByIdAndDelete(id);

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'DELETE_HOLIDAY',
      entity: 'Holiday',
      entity_id: String(id),
      before,
    });

    return NextResponse.json({ success: true, message: 'Holiday deleted' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
