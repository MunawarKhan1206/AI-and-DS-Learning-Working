import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';
import { createAuditLog } from '@/lib/audit';

export async function GET(req, { params }) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    // Server-side Data Scoping:
    // If caller is an employee, they can ONLY view their own profile!
    if (user.role === 'employee') {
      const ownEmpId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
      if (!ownEmpId || ownEmpId !== id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view other employees’ full profiles' },
          { status: 403 }
        );
      }
    }

    await connectDB();
    const employee = await Employee.findById(id)
      .populate('department_id', 'name code')
      .populate('designation_id', 'title');

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    await connectDB();

    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const before = employee.toObject();
    const body = await req.json();

    // Data Scoping & Permission check:
    if (user.role === 'employee') {
      const ownEmpId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
      if (!ownEmpId || ownEmpId !== id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only edit your own profile' },
          { status: 403 }
        );
      }

      // Business Rule: Employee can ONLY edit phone and address!
      if (body.phone !== undefined) employee.phone = body.phone;
      if (body.address !== undefined) employee.address = body.address;
    } else if (user.role === 'admin' || user.role === 'hr') {
      // HR/Admin can edit details, designations, salary structures
      if (body.first_name) employee.first_name = body.first_name.trim();
      if (body.last_name) employee.last_name = body.last_name.trim();
      if (body.phone !== undefined) employee.phone = body.phone;
      if (body.address !== undefined) employee.address = body.address;
      if (body.department_id) employee.department_id = body.department_id;
      if (body.designation_id) employee.designation_id = body.designation_id;
      if (body.status) employee.status = body.status;
      if (body.gender) employee.gender = body.gender;
      if (body.exit_date !== undefined) employee.exit_date = body.exit_date ? new Date(body.exit_date) : null;
      if (body.bank_account !== undefined) employee.bank_account = body.bank_account;
      if (body.tax_id !== undefined) employee.tax_id = body.tax_id;

      if (body.basic_salary !== undefined) {
        const basic = Number(body.basic_salary);
        employee.basic_salary = basic;
        employee.hra = Math.round(basic * 0.4);
        employee.medical = Math.round(basic * 0.1);
        employee.gross_salary = basic + employee.hra + employee.medical; // 1.5 * basic
      }
    }

    await employee.save();

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'UPDATE_EMPLOYEE',
      entity: 'Employee',
      entity_id: String(employee._id),
      before,
      after: employee.toObject(),
    });

    return NextResponse.json({ success: true, employee });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
