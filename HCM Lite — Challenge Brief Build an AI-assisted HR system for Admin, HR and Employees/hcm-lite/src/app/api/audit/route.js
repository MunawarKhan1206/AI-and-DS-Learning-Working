import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import AuditLog from '@/models/AuditLog';

export async function GET(req) {
  try {
    // Audit log: Admin view only!
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get('entity') || '';
    const action = searchParams.get('action') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const query = {};
    if (entity) query.entity = entity;
    if (action) query.action = action;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
