import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';

export async function GET(req) {
  try {
    const { errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();

    // Find the latest employee code to increment
    const latestEmployee = await Employee.findOne().sort({ createdAt: -1 }).select('employee_code');
    
    let nextNum = 1;
    if (latestEmployee && latestEmployee.employee_code) {
      const match = latestEmployee.employee_code.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }

    const nextCode = `EMP${String(nextNum).padStart(4, '0')}`;
    return NextResponse.json({ nextCode, nextNumber: nextNum });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
