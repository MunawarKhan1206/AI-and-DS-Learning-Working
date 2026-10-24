import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import User from '@/models/User';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const users = await User.find()
      .populate('employee_id', 'employee_code first_name last_name')
      .select('-password_hash')
      .sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'hr', 'employee']).default('hr'),
});

export async function POST(req) {
  try {
    // Only Admin can create users directly
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const validated = CreateUserSchema.parse(body);

    const existing = await User.findOne({ email: validated.email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: 'A user account with this email already exists' },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(validated.password, salt);

    const newUser = await User.create({
      email: validated.email.toLowerCase(),
      password_hash,
      role: validated.role,
      is_active: true,
      must_change_password: true,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: `CREATE_${validated.role.toUpperCase()}_USER`,
      entity: 'User',
      entity_id: String(newUser._id),
      after: { email: newUser.email, role: newUser.role },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
      },
      message: `${validated.role.toUpperCase()} user account created successfully`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
