import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const employees = await Employee.find()
      .populate('department_id', 'name code')
      .populate('designation_id', 'title')
      .sort({ employee_code: 1 });

    const headers = [
      'employee_code',
      'first_name',
      'last_name',
      'email',
      'phone',
      'department',
      'designation',
      'joining_date',
      'status',
      'gender',
      'basic_salary',
      'hra',
      'medical',
      'gross_salary',
    ];

    const lines = [headers.join(',')];

    for (const emp of employees) {
      const row = [
        `"${emp.employee_code || ''}"`,
        `"${emp.first_name || ''}"`,
        `"${emp.last_name || ''}"`,
        `"${emp.email || ''}"`,
        `"${emp.phone || ''}"`,
        `"${emp.department_id?.name || ''}"`,
        `"${emp.designation_id?.title || ''}"`,
        `"${emp.joining_date ? emp.joining_date.toISOString().split('T')[0] : ''}"`,
        `"${emp.status || ''}"`,
        `"${emp.gender || ''}"`,
        emp.basic_salary || 0,
        emp.hra || 0,
        emp.medical || 0,
        emp.gross_salary || 0,
      ];
      lines.push(row.join(','));
    }

    const csvData = lines.join('\n');

    return new Response(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employees-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
