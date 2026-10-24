import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    // Run ensureDefaultAdmin ONCE per server process (not on every login).
    // Module-level flag survives across requests in the same worker process.
    if (!global.__hcm_seeded) {
      const { ensureDefaultAdmin } = await import('@/lib/init-admin');
      await ensureDefaultAdmin();
      global.__hcm_seeded = true;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).populate('employee_id');
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account has been deactivated. Please contact an Administrator.' },
        { status: 403 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Sign JWT
    const token = signToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id ? user.employee_id._id : null,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        must_change_password: user.must_change_password,
        employee: user.employee_id || null,
      },
    });

    // Also set HTTP-only cookie for seamless browser sessions
    response.cookies.set('hcm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
