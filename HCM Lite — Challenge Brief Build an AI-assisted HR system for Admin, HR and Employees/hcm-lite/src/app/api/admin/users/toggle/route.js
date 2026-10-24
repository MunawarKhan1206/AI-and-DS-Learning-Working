import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import User from '@/models/User';
import { createAuditLog } from '@/lib/audit';

export async function POST(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const { target_user_id, action, new_password } = body;

    if (!target_user_id) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
    }

    const targetUser = await User.findById(target_user_id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin cannot deactivate themselves to avoid locking the system
    if (String(targetUser._id) === String(user._id) && action === 'deactivate') {
      return NextResponse.json(
        { error: 'Cannot deactivate your own active Admin account' },
        { status: 400 }
      );
    }

    const before = targetUser.toObject();

    if (action === 'deactivate') {
      targetUser.is_active = false;
    } else if (action === 'activate') {
      targetUser.is_active = true;
    } else if (action === 'reset_password') {
      if (!new_password || new_password.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters' },
          { status: 400 }
        );
      }
      const salt = await bcrypt.genSalt(10);
      targetUser.password_hash = await bcrypt.hash(new_password, salt);
      targetUser.must_change_password = true; // force change on next login
    }

    await targetUser.save();

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: `USER_${action.toUpperCase()}`,
      entity: 'User',
      entity_id: String(targetUser._id),
      before,
      after: targetUser.toObject(),
    });

    return NextResponse.json({
      success: true,
      message: `User ${action} performed successfully`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
