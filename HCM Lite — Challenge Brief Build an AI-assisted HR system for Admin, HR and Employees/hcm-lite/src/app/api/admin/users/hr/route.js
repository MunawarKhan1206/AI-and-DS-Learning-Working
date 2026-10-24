import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import User from '@/models/User';
import { createAuditLog } from '@/lib/audit';

const CreateHRSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function GET(req) {
  try {
    const { errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const hrUsers = await User.find({ role: 'hr' }).select('-password_hash');
    return NextResponse.json({ users: hrUsers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Only Admin can create HR logins
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const { email, password } = CreateHRSchema.parse(body);

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const hrUser = await User.create({
      email: email.toLowerCase(),
      password_hash,
      role: 'hr',
      is_active: true,
      must_change_password: true,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CREATE_HR_USER',
      entity: 'User',
      entity_id: String(hrUser._id),
      after: { email: hrUser.email, role: hrUser.role },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: hrUser._id,
        email: hrUser.email,
        role: hrUser.role,
      },
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
