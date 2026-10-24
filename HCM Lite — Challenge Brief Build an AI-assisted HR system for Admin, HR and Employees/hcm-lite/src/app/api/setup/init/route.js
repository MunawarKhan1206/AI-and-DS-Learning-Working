import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import CompanySettings from '@/models/CompanySettings';
import LeaveType from '@/models/LeaveType';
import { createAuditLog } from '@/lib/audit';

const SetupSchema = z.object({
  company_name: z.string().min(2, 'Company name is required'),
  admin_email: z.string().email('Valid email is required'),
  admin_password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req) {
  try {
    await connectDB();

    // Check if an admin already exists (system must be seed-free / empty first-run)
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Setup already completed. System already has an Admin account.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validated = SetupSchema.parse(body);

    // 1. Create or update CompanySettings
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        company_name: validated.company_name,
        office_start: '09:00',
        grace_minutes: 15,
        half_day_hours: 5,
        weekend_days: [0, 6],
        office_radius_meters: 150,
      });
    } else {
      settings.company_name = validated.company_name;
      await settings.save();
    }

    // 2. Initialize default Leave Types per brief rules (configurable later by Admin)
    const defaultLeaveTypes = [
      { name: 'Annual Leave', code: 'ANNUAL', quota: 14, is_paid: true },
      { name: 'Sick Leave', code: 'SICK', quota: 8, is_paid: true },
      { name: 'Casual Leave', code: 'CASUAL', quota: 10, is_paid: true },
      { name: 'Unpaid Leave', code: 'UNPAID', quota: 999, is_paid: false },
    ];

    for (const lt of defaultLeaveTypes) {
      const exists = await LeaveType.findOne({ code: lt.code });
      if (!exists) {
        await LeaveType.create(lt);
      }
    }

    // 3. Create Admin User
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(validated.admin_password, salt);

    const adminUser = await User.create({
      email: validated.admin_email.toLowerCase(),
      password_hash,
      role: 'admin',
      is_active: true,
      must_change_password: false,
    });

    // 4. Create immutable Audit Log
    await createAuditLog({
      actor: { _id: adminUser._id, email: adminUser.email, role: 'admin' },
      action: 'SYSTEM_INITIALIZATION',
      entity: 'System',
      entity_id: String(adminUser._id),
      after: {
        company_name: validated.company_name,
        admin_email: validated.admin_email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Company and Admin account initialized successfully',
      user: {
        id: adminUser._id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (err) {
    console.error('Setup initialization error:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to initialize system', details: err.message },
      { status: 500 }
    );
  }
}
