import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAdminAnalytics } from '@/services/analytics.service';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department') || '';

    const data = await getAdminAnalytics({ departmentId });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
