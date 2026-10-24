import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Department from '@/models/Department';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    let departments = await Department.find().sort({ name: 1 });

    if (departments.length === 0) {
      const defaultDepts = [
        { name: 'Engineering', code: 'ENG', description: 'Software Engineering and Technology' },
        { name: 'Human Resources', code: 'HR', description: 'People and Culture' },
        { name: 'Finance', code: 'FIN', description: 'Finance, Payroll and Accounting' },
        { name: 'Sales & Marketing', code: 'MKT', description: 'Sales and Growth' },
        { name: 'Operations', code: 'OPS', description: 'Business Operations' },
      ];
      for (const d of defaultDepts) {
        await Department.findOneAndUpdate({ code: d.code }, d, { upsert: true });
      }
      departments = await Department.find().sort({ name: 1 });
    }

    return NextResponse.json({ departments });
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
        { error: 'Department name and code are required' },
        { status: 400 }
      );
    }

    const existing = await Department.findOne({
      $or: [{ name: body.name.trim() }, { code: body.code.trim().toUpperCase() }],
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A department with this name or code already exists' },
        { status: 400 }
      );
    }

    const dept = await Department.create({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      description: body.description || '',
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CREATE_DEPARTMENT',
      entity: 'Department',
      entity_id: String(dept._id),
      after: dept.toObject(),
    });

    return NextResponse.json({ success: true, department: dept });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
