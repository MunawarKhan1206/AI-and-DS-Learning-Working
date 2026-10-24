import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Notification from '@/models/Notification';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const notifications = await Notification.find({ user_id: user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user_id: user._id,
      is_read: false,
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    await Notification.updateMany({ user_id: user._id, is_read: false }, { is_read: true });

    return NextResponse.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
