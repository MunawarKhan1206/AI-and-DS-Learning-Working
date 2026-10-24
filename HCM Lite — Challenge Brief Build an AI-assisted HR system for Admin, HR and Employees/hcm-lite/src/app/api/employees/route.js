import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';
import User from '@/models/User';
import { createAuditLog } from '@/lib/audit';

const EmployeeCreateSchema = z.object({
  employee_code: z.string().min(1, 'Employee code is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  department_id: z.string().min(1, 'Department is required'),
  designation_id: z.string().min(1, 'Designation is required'),
  joining_date: z.string().min(1, 'Joining date is required'),
  status: z.enum(['active', 'probation', 'resigned', 'terminated']).default('active'),
  gender: z.enum(['male', 'female', 'other']).default('male'),
  basic_salary: z.number().min(0, 'Basic salary must be non-negative'),
  bank_account: z.string().optional(),
  tax_id: z.string().optional(),
  temporary_password: z.string().min(6, 'Temporary password must be at least 6 characters'),
});

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const query = {};

    if (department) {
      query.department_id = department;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { employee_code: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Employee.countDocuments(query);

    // Data scoping: Employees cannot see other employees' salaries!
    let projection = {};
    if (user.role === 'employee') {
      projection = {
        basic_salary: 0,
        hra: 0,
        medical: 0,
        gross_salary: 0,
        bank_account: 0,
        tax_id: 0,
      };
    }

    const employees = await Employee.find(query, projection)
      .populate('department_id', 'name code')
      .populate('designation_id', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      employees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Only Admin or HR can register employees
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const validated = EmployeeCreateSchema.parse(body);

    // Check duplicate code or email
    const existingEmp = await Employee.findOne({
      $or: [{ employee_code: validated.employee_code.trim() }, { email: validated.email.toLowerCase() }],
    });
    if (existingEmp) {
      return NextResponse.json(
        { error: 'An employee with this code or email already exists' },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email: validated.email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A login account with this email already exists' },
        { status: 400 }
      );
    }

    // Compute salary breakdown
    const basic = Number(validated.basic_salary);
    const hra = Math.round(basic * 0.4);
    const medical = Math.round(basic * 0.1);
    const gross = basic + hra + medical;

    const employee = await Employee.create({
      employee_code: validated.employee_code.trim(),
      first_name: validated.first_name.trim(),
      last_name: validated.last_name.trim(),
      email: validated.email.toLowerCase(),
      phone: validated.phone || '',
      address: validated.address || '',
      department_id: validated.department_id,
      designation_id: validated.designation_id,
      joining_date: new Date(validated.joining_date),
      status: validated.status,
      gender: validated.gender,
      basic_salary: basic,
      hra,
      medical,
      gross_salary: gross,
      bank_account: validated.bank_account || '',
      tax_id: validated.tax_id || '',
    });

    // Create login account with temporary password & must_change_password: true
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(validated.temporary_password, salt);

    const loginAccount = await User.create({
      email: validated.email.toLowerCase(),
      password_hash,
      role: 'employee',
      is_active: true,
      must_change_password: true,
      employee_id: employee._id,
    });

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'REGISTER_EMPLOYEE',
      entity: 'Employee',
      entity_id: String(employee._id),
      after: employee.toObject(),
    });

    return NextResponse.json({
      success: true,
      employee,
      user_id: loginAccount._id,
      message: 'Employee registered and login created with temporary password',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
