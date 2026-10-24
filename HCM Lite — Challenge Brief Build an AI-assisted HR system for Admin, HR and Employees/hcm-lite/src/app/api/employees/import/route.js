import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';
import User from '@/models/User';
import Department from '@/models/Department';
import Designation from '@/models/Designation';
import { createAuditLog } from '@/lib/audit';

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const values = rawLine.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push({ rowNumber: i + 1, data: rowObj });
  }
  return rows;
}

export async function POST(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const { csv_content, dry_run = true } = body;

    if (!csv_content) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    const rows = parseCSV(csv_content);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid data rows found in CSV' }, { status: 400 });
    }

    // Cache departments and designations for fast lookup
    const departments = await Department.find();
    const designations = await Designation.find();
    const deptMap = new Map();
    departments.forEach((d) => {
      deptMap.set(d.name.toLowerCase(), d._id);
      deptMap.set(d.code.toLowerCase(), d._id);
    });

    const desigMap = new Map();
    designations.forEach((d) => {
      desigMap.set(d.title.toLowerCase(), d._id);
    });

    const existingEmpCodes = new Set(
      (await Employee.find({}, 'employee_code')).map((e) => e.employee_code.toLowerCase())
    );
    const existingEmails = new Set(
      (await Employee.find({}, 'email')).map((e) => e.email.toLowerCase())
    );

    const validationErrors = [];
    const validRecords = [];

    // Row-by-row dry run validation
    for (const { rowNumber, data } of rows) {
      const rowErrors = [];

      const empCode = data.employee_code || data.code;
      if (!empCode) {
        rowErrors.push({ row: rowNumber, field: 'employee_code', reason: 'Employee code is required' });
      } else if (existingEmpCodes.has(empCode.toLowerCase())) {
        rowErrors.push({ row: rowNumber, field: 'employee_code', reason: `Employee code '${empCode}' already exists` });
      }

      const email = data.email;
      if (!email || !email.includes('@')) {
        rowErrors.push({ row: rowNumber, field: 'email', reason: 'A valid email address is required' });
      } else if (existingEmails.has(email.toLowerCase())) {
        rowErrors.push({ row: rowNumber, field: 'email', reason: `Email '${email}' already registered` });
      }

      if (!data.first_name) {
        rowErrors.push({ row: rowNumber, field: 'first_name', reason: 'First name is required' });
      }
      if (!data.last_name) {
        rowErrors.push({ row: rowNumber, field: 'last_name', reason: 'Last name is required' });
      }

      const deptKey = (data.department || '').toLowerCase();
      const departmentId = deptMap.get(deptKey);
      if (!departmentId) {
        rowErrors.push({
          row: rowNumber,
          field: 'department',
          reason: `Department '${data.department}' does not exist. Please create it first.`,
        });
      }

      const desigKey = (data.designation || '').toLowerCase();
      const designationId = desigMap.get(desigKey);
      if (!designationId) {
        rowErrors.push({
          row: rowNumber,
          field: 'designation',
          reason: `Designation '${data.designation}' does not exist. Please create it first.`,
        });
      }

      const basicSalary = Number(data.basic_salary || data.salary || 0);
      if (isNaN(basicSalary) || basicSalary < 0) {
        rowErrors.push({ row: rowNumber, field: 'basic_salary', reason: 'Basic salary must be a positive number' });
      }

      const joiningDate = data.joining_date ? new Date(data.joining_date) : new Date();
      if (isNaN(joiningDate.getTime())) {
        rowErrors.push({ row: rowNumber, field: 'joining_date', reason: 'Invalid joining date format (use YYYY-MM-DD)' });
      }

      if (rowErrors.length > 0) {
        validationErrors.push(...rowErrors);
      } else {
        // Track seen codes in the current batch to avoid in-file duplicates
        existingEmpCodes.add(empCode.toLowerCase());
        existingEmails.add(email.toLowerCase());

        const hra = Math.round(basicSalary * 0.4);
        const medical = Math.round(basicSalary * 0.1);
        const gross = basicSalary + hra + medical;

        validRecords.push({
          employee_code: empCode.trim(),
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          email: email.toLowerCase().trim(),
          phone: data.phone || '',
          address: data.address || '',
          department_id: departmentId,
          designation_id: designationId,
          joining_date: joiningDate,
          gender: data.gender || 'male',
          status: 'active',
          basic_salary: basicSalary,
          hra,
          medical,
          gross_salary: gross,
          temporary_password: data.temporary_password || 'Welcome@123',
        });
      }
    }

    if (dry_run) {
      return NextResponse.json({
        dry_run: true,
        isValid: validationErrors.length === 0,
        totalRows: rows.length,
        validCount: validRecords.length,
        errorCount: validationErrors.length,
        errors: validationErrors,
      });
    }

    // If actual import is requested but errors exist, refuse import!
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot import with validation errors. Please fix errors and re-upload.',
          errors: validationErrors,
        },
        { status: 422 }
      );
    }

    // Execute actual import
    const createdEmployees = [];
    for (const record of validRecords) {
      const emp = await Employee.create(record);
      createdEmployees.push(emp);

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(record.temporary_password, salt);

      await User.create({
        email: record.email,
        password_hash,
        role: 'employee',
        is_active: true,
        must_change_password: true,
        employee_id: emp._id,
      });
    }

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'CSV_IMPORT_EMPLOYEES',
      entity: 'Employee',
      after: { importedCount: createdEmployees.length },
    });

    return NextResponse.json({
      success: true,
      importedCount: createdEmployees.length,
      message: `Successfully imported ${createdEmployees.length} employees with login credentials.`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
