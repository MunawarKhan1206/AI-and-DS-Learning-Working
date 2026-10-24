import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Designation from '@/models/Designation';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    let designations = await Designation.find()
      .populate('department_id', 'name code')
      .sort({ title: 1 });

    if (designations.length === 0) {
      const Department = (await import('@/models/Department')).default;
      const eng = await Department.findOne({ code: 'ENG' });
      const hr = await Department.findOne({ code: 'HR' });
      const fin = await Department.findOne({ code: 'FIN' });
      const mkt = await Department.findOne({ code: 'MKT' });
      const ops = await Department.findOne({ code: 'OPS' });

      const defaultDesignations = [
        { title: 'Software Engineer', department_id: eng?._id || null },
        { title: 'Senior Software Engineer', department_id: eng?._id || null },
        { title: 'HR Manager', department_id: hr?._id || null },
        { title: 'Accountant', department_id: fin?._id || null },
        { title: 'Marketing Specialist', department_id: mkt?._id || null },
        { title: 'Operations Executive', department_id: ops?._id || null },
      ];

      for (const des of defaultDesignations) {
        await Designation.findOneAndUpdate({ title: des.title }, des, { upsert: true });
      }

      designations = await Designation.find()
        .populate('department_id', 'name code')
        .sort({ title: 1 });
    }

    return NextResponse.json({ designations });
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

    if (!body.title) {
      return NextResponse.json(
        { error: 'Designation title is required' },
        { status: 400 }
      );
    }

    const existing = await Designation.findOne({ title: body.title.trim() });
    if (existing) {
      return NextResponse.json(
        { error: 'A designation with this title already exists' },
        { status: 400 }
      );
    }

    const designation = await Designation.create({
      title: body.title.trim(),
      department_id: body.department_id || null,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CREATE_DESIGNATION',
      entity: 'Designation',
      entity_id: String(designation._id),
      after: designation.toObject(),
    });

    return NextResponse.json({ success: true, designation });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
