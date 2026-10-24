import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

const ChangePasswordSchema = z.object({
  current_password: z.string().optional(),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
});

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { current_password, new_password } = ChangePasswordSchema.parse(body);

    // If user wasn't forced to change password, require current password verification
    if (!user.must_change_password) {
      if (!current_password) {
        return NextResponse.json(
          { error: 'Current password is required' },
          { status: 400 }
        );
      }
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Current password does not match' },
          { status: 400 }
        );
      }
    }

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(new_password, salt);
    user.must_change_password = false;
    await user.save();

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entity_id: String(user._id),
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
