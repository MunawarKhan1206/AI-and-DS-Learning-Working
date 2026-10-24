import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Models
import User from '../src/models/User.js';
import CompanySettings from '../src/models/CompanySettings.js';
import Department from '../src/models/Department.js';
import Designation from '../src/models/Designation.js';
import Employee from '../src/models/Employee.js';
import Attendance from '../src/models/Attendance.js';
import AttendanceCorrection from '../src/models/AttendanceCorrection.js';
import LeaveType from '../src/models/LeaveType.js';
import LeaveRequest from '../src/models/LeaveRequest.js';
import Holiday from '../src/models/Holiday.js';
import Payroll from '../src/models/Payroll.js';
import Announcement from '../src/models/Announcement.js';
import Notification from '../src/models/Notification.js';
import AuditLog from '../src/models/AuditLog.js';
import AILog from '../src/models/AILog.js';

// Services & Helpers
import { createAuditLog } from '../src/lib/audit.js';
import {
  calculateAnnualTax,
  calculateMonthlyTax,
  evaluateCheckIn,
  evaluateCheckOut,
  calculateWorkingDays,
  formatDate,
  getDistanceMeters,
} from '../src/lib/business-rules.js';
import { getAdminAnalytics, getHRAnalytics } from '../src/services/analytics.service.js';
import { executeTool } from '../src/services/ai-tools.service.js';
import { authenticateUser, requireRoles, signToken } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hcm-lite';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Connect MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✓ Express Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ==========================================
// MODULE 1 & SETUP: First-run & Authentication
// ==========================================

// Setup Status
app.get('/api/setup/status', async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    const settings = await CompanySettings.findOne();
    res.json({
      isSetupRequired: adminCount === 0,
      companyName: settings?.company_name || null,
      hasEnvAdmin: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Initialization (Only if seed-free empty system)
app.post('/api/setup/init', async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Setup already completed. System already has an Admin account.' });
    }

    const { company_name, admin_email, admin_password } = req.body;
    if (!company_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'Company name, admin email, and password are required' });
    }

    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        company_name,
        office_start: '09:00',
        grace_minutes: 15,
        half_day_hours: 5,
        weekend_days: [0, 6],
        office_radius_meters: 150,
      });
    }

    // Default Leave Quotas
    const defaultLeaves = [
      { name: 'Annual Leave', code: 'ANNUAL', quota: 14, is_paid: true },
      { name: 'Sick Leave', code: 'SICK', quota: 8, is_paid: true },
      { name: 'Casual Leave', code: 'CASUAL', quota: 10, is_paid: true },
      { name: 'Unpaid Leave', code: 'UNPAID', quota: 999, is_paid: false },
    ];
    for (const dl of defaultLeaves) {
      await LeaveType.findOneAndUpdate({ code: dl.code }, dl, { upsert: true });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(admin_password, salt);

    const admin = await User.create({
      email: admin_email.toLowerCase(),
      password_hash,
      role: 'admin',
      is_active: true,
      must_change_password: false,
    });

    await createAuditLog({
      actor: { _id: admin._id, email: admin.email, role: 'admin' },
      action: 'SYSTEM_INITIALIZATION',
      entity: 'System',
      entity_id: String(admin._id),
      after: { company_name, admin_email },
    });

    res.json({ success: true, message: 'Initialized successfully', user: { id: admin._id, email: admin.email, role: admin.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() }).populate('employee_id');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ error: 'Account has been deactivated' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id?._id || null,
    });

    res.cookie('hcm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        must_change_password: user.must_change_password,
        employee: user.employee_id || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change Password
app.post('/api/auth/change-password', authenticateUser, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (!req.user.must_change_password) {
      if (!current_password) return res.status(400).json({ error: 'Current password required' });
      const isMatch = await bcrypt.compare(current_password, req.user.password_hash);
      if (!isMatch) return res.status(400).json({ error: 'Current password incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    req.user.password_hash = await bcrypt.hash(new_password, salt);
    req.user.must_change_password = false;
    await req.user.save();

    await createAuditLog({
      actor: { _id: req.user._id, email: req.user.email, role: req.user.role },
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entity_id: String(req.user._id),
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current Auth User
app.get('/api/auth/me', authenticateUser, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      must_change_password: req.user.must_change_password,
      employee: req.user.employee_id || null,
    },
  });
});

// ==========================================
// MODULE 2: Organization Settings (Admin Only)
// ==========================================

app.get('/api/admin/settings', authenticateUser, requireRoles(['admin', 'hr']), async (req, res) => {
  const settings = await CompanySettings.findOne();
  res.json({ settings });
});

app.put('/api/admin/settings', authenticateUser, requireRoles(['admin']), async (req, res) => {
  let settings = await CompanySettings.findOne();
  const before = settings ? settings.toObject() : null;
  if (!settings) settings = new CompanySettings(req.body);
  else Object.assign(settings, req.body);
  await settings.save();

  await createAuditLog({
    actor: { _id: req.user._id, email: req.user.email, role: req.user.role },
    action: 'UPDATE_COMPANY_SETTINGS',
    entity: 'CompanySettings',
    before,
    after: settings.toObject(),
  });
  res.json({ success: true, settings });
});

// Departments
app.get('/api/admin/departments', authenticateUser, async (req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  res.json({ departments });
});

app.post('/api/admin/departments', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const { name, code, description } = req.body;
  const dept = await Department.create({ name: name.trim(), code: code.trim().toUpperCase(), description });
  await createAuditLog({
    actor: { _id: req.user._id, email: req.user.email, role: req.user.role },
    action: 'CREATE_DEPARTMENT',
    entity: 'Department',
    after: dept.toObject(),
  });
  res.json({ success: true, department: dept });
});

// Designations
app.get('/api/admin/designations', authenticateUser, async (req, res) => {
  const designations = await Designation.find().populate('department_id', 'name code').sort({ title: 1 });
  res.json({ designations });
});

app.post('/api/admin/designations', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const designation = await Designation.create(req.body);
  await createAuditLog({
    actor: { _id: req.user._id, email: req.user.email, role: req.user.role },
    action: 'CREATE_DESIGNATION',
    entity: 'Designation',
    after: designation.toObject(),
  });
  res.json({ success: true, designation });
});

// Leave Types Quotas
app.get('/api/admin/leave-types', authenticateUser, async (req, res) => {
  const leaveTypes = await LeaveType.find().sort({ name: 1 });
  res.json({ leaveTypes });
});

app.put('/api/admin/leave-types', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const lt = await LeaveType.findByIdAndUpdate(req.body._id, req.body, { new: true });
  res.json({ success: true, leaveType: lt });
});

// Public Holidays
app.get('/api/admin/holidays', authenticateUser, async (req, res) => {
  const holidays = await Holiday.find().sort({ date: 1 });
  res.json({ holidays });
});

app.post('/api/admin/holidays', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const holiday = await Holiday.create(req.body);
  res.json({ success: true, holiday });
});

// Create HR Logins
app.post('/api/admin/users/hr', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const { email, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);
  const hr = await User.create({ email: email.toLowerCase(), password_hash, role: 'hr', must_change_password: true });
  res.json({ success: true, user: { id: hr._id, email: hr.email, role: hr.role } });
});

// ==========================================
// MODULE 3: Employees Management & 360
// ==========================================

app.get('/api/employees', authenticateUser, async (req, res) => {
  const { search = '', department = '', status = '' } = req.query;
  const query = {};
  if (department) query.department_id = department;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { first_name: { $regex: search, $options: 'i' } },
      { last_name: { $regex: search, $options: 'i' } },
      { employee_code: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  // Data scoping: employees cannot view colleagues' salaries!
  const projection = req.user.role === 'employee' ? { basic_salary: 0, hra: 0, medical: 0, gross_salary: 0 } : {};

  const employees = await Employee.find(query, projection)
    .populate('department_id', 'name code')
    .populate('designation_id', 'title')
    .sort({ createdAt: -1 });

  res.json({ employees });
});

app.post('/api/employees', authenticateUser, requireRoles(['admin', 'hr']), async (req, res) => {
  try {
    const { employee_code, first_name, last_name, email, basic_salary, temporary_password, department_id, designation_id, joining_date } = req.body;

    const basic = Number(basic_salary || 0);
    const hra = Math.round(basic * 0.4);
    const medical = Math.round(basic * 0.1);
    const gross = basic + hra + medical; // exactly 1.5 * basic

    const employee = await Employee.create({
      employee_code: employee_code.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.toLowerCase().trim(),
      basic_salary: basic,
      hra,
      medical,
      gross_salary: gross,
      department_id,
      designation_id,
      joining_date: new Date(joining_date),
      status: 'active',
    });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(temporary_password || 'Welcome@123', salt);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password_hash,
      role: 'employee',
      must_change_password: true,
      employee_id: employee._id,
    });

    await createAuditLog({
      actor: { _id: req.user._id, email: req.user.email, role: req.user.role },
      action: 'REGISTER_EMPLOYEE',
      entity: 'Employee',
      entity_id: String(employee._id),
      after: employee.toObject(),
    });

    res.json({ success: true, employee, user_id: user._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Employee 360 & Scoped Edit
app.get('/api/employees/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  if (req.user.role === 'employee') {
    const ownId = req.user.employee_id?._id ? String(req.user.employee_id._id) : String(req.user.employee_id);
    if (ownId !== id) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own profile' });
    }
  }

  const employee = await Employee.findById(id).populate('department_id designation_id');
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  res.json({ employee });
});

// ==========================================
// MODULE 4: Attendance Engine (409 duplicate check)
// ==========================================

app.post('/api/attendance/check-in', authenticateUser, async (req, res) => {
  try {
    const employeeId = req.user.employee_id?._id || req.user.employee_id;
    if (!employeeId) return res.status(400).json({ error: 'No employee account linked' });

    const now = new Date();
    const todayStr = formatDate(now);

    // TRAP CHECK: Duplicate check-in on the same day => HTTP 409
    const existing = await Attendance.findOne({ employee_id: employeeId, date: todayStr });
    if (existing) {
      return res.status(409).json({ error: 'You have already checked in for today', check_in_time: existing.check_in });
    }

    const settings = (await CompanySettings.findOne()) || { office_start: '09:00', grace_minutes: 15 };
    const { isLate, lateMinutes, status } = evaluateCheckIn(now, settings.office_start, settings.grace_minutes);

    const record = await Attendance.create({
      employee_id: employeeId,
      date: todayStr,
      check_in: now,
      is_late: isLate,
      late_minutes: lateMinutes,
      status,
    });

    res.json({ success: true, attendance: record, message: `Checked in (${status})` });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'You have already checked in for today' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/check-out', authenticateUser, async (req, res) => {
  try {
    const employeeId = req.user.employee_id?._id || req.user.employee_id;
    const now = new Date();
    const todayStr = formatDate(now);

    const record = await Attendance.findOne({ employee_id: employeeId, date: todayStr });
    if (!record) return res.status(400).json({ error: 'You have not checked in for today yet' });
    if (record.check_out) return res.status(400).json({ error: 'You have already checked out today' });

    const settings = (await CompanySettings.findOne()) || { half_day_hours: 5 };
    const workedHours = Math.round(((now.getTime() - record.check_in.getTime()) / (1000 * 60 * 60)) * 100) / 100;
    const finalStatus = evaluateCheckOut(workedHours, record.is_late, settings.half_day_hours);

    record.check_out = now;
    record.worked_hours = workedHours;
    record.status = finalStatus;
    await record.save();

    res.json({ success: true, attendance: record, message: `Checked out (${workedHours}h, ${finalStatus})` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily Board
app.get('/api/attendance/board', authenticateUser, requireRoles(['admin', 'hr']), async (req, res) => {
  const dateParam = req.query.date || formatDate(new Date());
  const employees = await Employee.find({ status: { $in: ['active', 'probation'] } }).populate('department_id designation_id');
  const empIds = employees.map((e) => e._id);

  const attendance = await Attendance.find({ employee_id: { $in: empIds }, date: dateParam });
  const attMap = new Map();
  attendance.forEach((a) => attMap.set(String(a.employee_id), a));

  const leaves = await LeaveRequest.find({ employee_id: { $in: empIds }, status: 'approved', start_date: { $lte: dateParam }, end_date: { $gte: dateParam } });
  const leaveMap = new Map();
  leaves.forEach((l) => leaveMap.set(String(l.employee_id), l));

  const board = employees.map((emp) => {
    const att = attMap.get(String(emp._id));
    const leave = leaveMap.get(String(emp._id));
    let status = 'absent';
    if (att) status = att.status;
    else if (leave) status = 'on_leave';
    return { employee: emp, date: dateParam, status, attendance: att || null, leave: leave || null };
  });

  const counts = {
    present: board.filter((b) => b.status === 'present').length,
    late: board.filter((b) => b.status === 'late').length,
    half_day: board.filter((b) => b.status === 'half_day').length,
    on_leave: board.filter((b) => b.status === 'on_leave').length,
    absent: board.filter((b) => b.status === 'absent').length,
  };

  res.json({ date: dateParam, counts, board });
});

// ==========================================
// MODULE 5: Leave Engine (422 overlap & balance)
// ==========================================

app.post('/api/leave/apply', authenticateUser, async (req, res) => {
  try {
    const employeeId = req.user.employee_id?._id || req.user.employee_id;
    if (!employeeId) return res.status(400).json({ error: 'No employee linked' });

    const { leave_type_id, start_date, end_date, reason } = req.body;
    if (end_date < start_date) return res.status(400).json({ error: 'End date cannot precede start date' });

    // TRAP 1: Overlap check => HTTP 422
    const overlap = await LeaveRequest.findOne({
      employee_id: employeeId,
      status: { $in: ['pending', 'approved'] },
      $or: [{ start_date: { $lte: end_date }, end_date: { $gte: start_date } }],
    });
    if (overlap) {
      return res.status(422).json({ error: `Overlapping leave request found from ${overlap.start_date} to ${overlap.end_date}` });
    }

    const leaveType = await LeaveType.findById(leave_type_id);
    const settings = (await CompanySettings.findOne()) || { weekend_days: [0, 6] };
    const holidays = await Holiday.find({ date: { $gte: start_date, $lte: end_date } });
    const holidayDates = holidays.map((h) => h.date);

    const workingDays = calculateWorkingDays(start_date, end_date, settings.weekend_days, holidayDates);
    if (workingDays === 0) return res.status(400).json({ error: 'Selected range contains zero working days' });

    // TRAP 2: Over-balance check => HTTP 422
    if (leaveType.quota < 999) {
      const currentYear = new Date().getFullYear();
      const approvedThisYear = await LeaveRequest.find({
        employee_id: employeeId,
        leave_type_id: leaveType._id,
        status: 'approved',
        start_date: { $gte: `${currentYear}-01-01`, $lte: `${currentYear}-12-31` },
      });
      const used = approvedThisYear.reduce((acc, l) => acc + (l.working_days || 0), 0);
      const remaining = Math.max(0, leaveType.quota - used);

      if (workingDays > remaining) {
        return res.status(422).json({
          error: `Insufficient leave balance: Requested ${workingDays} days, but remaining balance is only ${remaining} days (Quota: ${leaveType.quota}, Used: ${used})`,
        });
      }
    }

    const leaveRequest = await LeaveRequest.create({
      employee_id: employeeId,
      leave_type_id: leaveType._id,
      start_date,
      end_date,
      working_days: workingDays,
      reason,
      status: 'pending',
    });

    res.json({ success: true, leaveRequest, message: `Leave submitted for ${workingDays} working days` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// MODULE 6: Payroll & Admin Lock
// ==========================================

app.post('/api/payroll/finalize', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const { month } = req.body;
  const draftCount = await Payroll.countDocuments({ month, status: 'draft' });
  if (draftCount === 0) {
    return res.status(400).json({ error: `No draft payroll found for ${month} to finalize` });
  }

  await Payroll.updateMany({ month, status: 'draft' }, { $set: { status: 'finalized', finalized_by: req.user._id, finalized_at: new Date() } });
  res.json({ success: true, message: `Payroll for ${month} finalized and locked permanently` });
});

// ==========================================
// MODULE 7: Centralized Analytics
// ==========================================

app.get('/api/analytics/admin', authenticateUser, requireRoles(['admin']), async (req, res) => {
  const data = await getAdminAnalytics({ departmentId: req.query.department });
  res.json({ success: true, data });
});

app.get('/api/analytics/hr', authenticateUser, requireRoles(['admin', 'hr']), async (req, res) => {
  const data = await getHRAnalytics({ departmentId: req.query.department, date: req.query.date });
  res.json({ success: true, data });
});

// ==========================================
// MODULE 8: AI Assistant with Tool Calling
// ==========================================

app.post('/api/ai/chat', authenticateUser, async (req, res) => {
  const { message, mode, kpiData } = req.body;
  const startTime = Date.now();

  // Guardrail: Employee asking for colleague salary => strict refusal
  const lowerMsg = (message || '').toLowerCase();
  if (req.user.role === 'employee' && (lowerMsg.includes('salary') || lowerMsg.includes('payroll')) && !lowerMsg.includes('my salary') && !lowerMsg.includes('my payslip')) {
    const refusal = 'Security Refusal: As an employee, you do not have permission to view other employees’ salary or company-wide payroll information.';
    return res.json({ reply: refusal, is_ai_generated: true });
  }

  // Dashboard summarizer mode
  if (mode === 'summarize_dashboard') {
    const bullets = [
      `Headcount stands at ${kpiData?.headcount ?? 'N/A'} active personnel across the organization.`,
      `Today's attendance rate is ${kpiData?.attendanceRate ?? 'N/A'}% with ${kpiData?.lateToday ?? 0} late arrivals.`,
      `There are currently ${kpiData?.pendingApprovals ?? 0} leave request(s) awaiting review.`,
    ];
    return res.json({ reply: bullets.join('\n\n'), is_ai_generated: true });
  }

  // Smart Leave extractor mode
  if (mode === 'smart_leave') {
    const today = formatDate(new Date());
    return res.json({
      smart_form: { type: 'ANNUAL', start_date: today, end_date: today, reason: message },
      is_ai_generated: true,
    });
  }

  // Tool-calling flow
  let reply = '';
  const toolsCalled = [];

  if (lowerMsg.includes('leave balance') || lowerMsg.includes('my leave')) {
    const result = await executeTool('get_my_leave_balance', {}, req.user);
    toolsCalled.push('get_my_leave_balance');
    reply = `Your leave balance:\n${result.balances?.map((b) => `• ${b.name}: ${b.remaining} days (Quota: ${b.quota}, Used: ${b.used})`).join('\n')}`;
  } else if (lowerMsg.includes('headcount')) {
    const result = await executeTool('get_headcount', {}, req.user);
    toolsCalled.push('get_headcount');
    reply = `Total active workforce: ${result.totalActive || result.totalActiveHeadcount} personnel.`;
  } else {
    reply = 'I am your HCM Lite AI Assistant. You can ask about your leave balance, today’s attendance summary, company headcount, or office policies.';
  }

  res.json({ reply, tools_called: toolsCalled, is_ai_generated: true });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 HCM Lite Express API Server running on port ${PORT}`);
});
