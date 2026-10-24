import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Announcement from '@/models/Announcement';
import { createAuditLog } from '@/lib/audit';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const query = {
      $or: [{ target_role: 'all' }, { target_role: user.role }],
    };

    const announcements = await Announcement.find(query)
      .populate('author_id', 'email role')
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json({ announcements });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Admin or HR can post announcements
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const { title, content, target_role = 'all' } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      target_role,
      author_id: user._id,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'POST_ANNOUNCEMENT',
      entity: 'Announcement',
      entity_id: String(announcement._id),
      after: announcement.toObject(),
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
