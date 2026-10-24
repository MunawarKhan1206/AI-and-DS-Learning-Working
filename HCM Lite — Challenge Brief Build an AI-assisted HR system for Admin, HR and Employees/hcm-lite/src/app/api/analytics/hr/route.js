import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getHRAnalytics } from '@/services/analytics.service';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department') || '';
    const date = searchParams.get('date') || '';

    const data = await getHRAnalytics({ departmentId, date });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
