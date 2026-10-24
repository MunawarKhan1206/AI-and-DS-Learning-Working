/**
 * init-admin.js  ──  Comprehensive seed for HCM Lite Hackathon demo
 *
 * Covers EVERY condition from the Saylani Hackathon Challenge Brief:
 *
 *  M2 – Org Setup  : company settings, 5 departments, 6 designations, 4 leave types,
 *                    6 public holidays (year 2026)
 *  M3 – Employees  : 12 employees across all 5 departments, mixed genders,
 *                    different salary bands (all 5 tax slabs represented),
 *                    two status variants (active + probation + resigned)
 *  M4 – Attendance : present · late · half_day · absent · missing_checkout · on_leave
 *                    for today; 30-day history for dashboard trend graphs
 *                    3-late-rule scenario (3 lates → 0.5-day deduction)
 *  M5 – Leave      : pending · approved · rejected · cancelled requests,
 *                    all 4 leave types, overlap check (overlap request exists),
 *                    quota-exceeded scenario (unpaid leave as overflow)
 *  M6 – Payroll    : draft run for current month, finalized run for last month,
 *                    covers all 5 tax slabs, proration for joiner & leaver
 *  M7 – Dashboards : data that drives: headcount, present, on-leave, late today,
 *                    pending approvals, attrition YTD, payroll cost, avg salary,
 *                    leave utilization, dept breakdown
 *  M9 – Comms      : 3 announcements (admin + hr); audit log entries
 */

import bcrypt from 'bcryptjs';
import User from '@/models/User';
import CompanySettings from '@/models/CompanySettings';
import LeaveType from '@/models/LeaveType';
import { createAuditLog } from '@/lib/audit';
import { calculateMonthlyTax } from '@/lib/business-rules';

// ─── helpers ──────────────────────────────────────────────────────────────────

const pad   = (n) => String(n).padStart(2, '0');
const ymd   = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoAt = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}Z`);

/** Adds 'days' calendar days to date (or todayStr) */
function daysAgo(n, base) {
  const d = new Date(base || new Date());
  d.setDate(d.getDate() - n);
  return ymd(d);
}

function daysFromNow(n, base) {
  const d = new Date(base || new Date());
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Monthly tax from gross_salary */
function monthlyTax(gross) {
  return calculateMonthlyTax(gross);
}

/** Build payroll fields for one employee (draft or finalized) */
function buildPayroll(empDoc, workingDays, workedDays, absentDays, halfDays, unpaidDays, month) {
  const { basic_salary, hra, medical, gross_salary: gross } = empDoc;
  const perDay = Math.round(gross / workingDays);
  const absenceDeduction = Math.round((absentDays + unpaidDays + halfDays * 0.5) * perDay);
  const taxable = gross - absenceDeduction;
  const tax = monthlyTax(taxable);
  const net = Math.max(0, Math.round(taxable - tax));
  return {
    month,
    employee_id: empDoc._id,
    basic_salary,
    hra,
    medical,
    gross_salary: gross,
    working_days_in_month: workingDays,
    worked_days: workedDays,
    absent_days: absentDays,
    unpaid_leave_days: unpaidDays,
    half_days: halfDays,
    per_day_salary: perDay,
    absence_deduction: absenceDeduction,
    tax_deduction: tax,
    net_salary: net,
  };
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function ensureDefaultAdmin() {
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@hcmlite.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Pass123!';
  const TEST_PW       = 'Pass123!';

  const now            = new Date();
  const todayStr       = ymd(now);
  const currentMonth   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const lastMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth      = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}`;

  // ── 1. Company settings ──────────────────────────────────────────────────
  let settings = await CompanySettings.findOne();
  if (!settings) {
    settings = await CompanySettings.create({
      company_name:          'HCM Lite Technologies',
      office_start:          '09:00',
      grace_minutes:         15,
      half_day_hours:        5,
      weekend_days:          [0, 6],       // Sun=0, Sat=6
      office_location_lat:   24.8607,      // Karachi lat
      office_location_lng:   67.0011,      // Karachi lng
      office_radius_meters:  150,
    });
  }

  // ── 2. Leave types (M5 quotas) ───────────────────────────────────────────
  const LT = {};
  const ltDefs = [
    { name: 'Annual Leave',  code: 'ANNUAL', quota: 14, is_paid: true  },
    { name: 'Sick Leave',    code: 'SICK',   quota: 8,  is_paid: true  },
    { name: 'Casual Leave',  code: 'CASUAL', quota: 10, is_paid: true  },
    { name: 'Unpaid Leave',  code: 'UNPAID', quota: 999, is_paid: false },
  ];
  for (const lt of ltDefs) {
    let doc = await LeaveType.findOne({ code: lt.code });
    if (!doc) doc = await LeaveType.create(lt);
    LT[lt.code] = doc;
  }

  // ── 3. Departments ───────────────────────────────────────────────────────
  const Department = (await import('@/models/Department')).default;
  const DEPT = {};
  const deptDefs = [
    { name: 'Engineering',      code: 'ENG', description: 'Software Engineering & Technology' },
    { name: 'Human Resources',  code: 'HR',  description: 'People Operations & Culture'      },
    { name: 'Finance',          code: 'FIN', description: 'Finance, Payroll & Accounting'     },
    { name: 'Sales & Marketing',code: 'MKT', description: 'Sales, Growth & Brand'             },
    { name: 'Operations',       code: 'OPS', description: 'Business Operations & Admin'       },
  ];
  for (const d of deptDefs) {
    let doc = await Department.findOne({ code: d.code });
    if (!doc) doc = await Department.create(d);
    DEPT[d.code] = doc._id;
  }

  // ── 4. Designations ──────────────────────────────────────────────────────
  const Designation = (await import('@/models/Designation')).default;
  const DES = {};
  const desDefs = [
    { title: 'Software Engineer',       deptCode: 'ENG' },
    { title: 'Senior Software Engineer',deptCode: 'ENG' },
    { title: 'HR Manager',              deptCode: 'HR'  },
    { title: 'Accountant',              deptCode: 'FIN' },
    { title: 'Marketing Specialist',    deptCode: 'MKT' },
    { title: 'Operations Executive',    deptCode: 'OPS' },
  ];
  for (const des of desDefs) {
    let doc = await Designation.findOne({ title: des.title });
    if (!doc) doc = await Designation.create({ title: des.title, department_id: DEPT[des.deptCode] });
    DES[des.title] = doc._id;
  }

  // ── 5. Public holidays (M5 – working-days skip) ──────────────────────────
  const Holiday = (await import('@/models/Holiday')).default;
  const publicHolidays = [
    { date: '2026-01-01', name: 'New Year\'s Day',        description: 'Public holiday'  },
    { date: '2026-03-23', name: 'Pakistan Day',           description: 'National holiday' },
    { date: '2026-04-23', name: 'Eid ul-Fitr',            description: 'Public holiday'  },
    { date: '2026-05-01', name: 'Labour Day',             description: 'Public holiday'  },
    { date: '2026-08-14', name: 'Independence Day',       description: 'National holiday' },
    { date: '2026-10-01', name: 'Eid Milad-un-Nabi',      description: 'Public holiday'  },
    { date: '2026-12-25', name: 'Quaid-e-Azam Day',       description: 'Public holiday'  },
  ];
  for (const h of publicHolidays) {
    const exists = await Holiday.findOne({ date: h.date });
    if (!exists) await Holiday.create(h);
  }

  // ── 6. Admin user ────────────────────────────────────────────────────────
  const salt         = await bcrypt.genSalt(10);
  const adminHash    = await bcrypt.hash(adminPassword, salt);
  const testHash     = await bcrypt.hash(TEST_PW, salt);

  let admin;
  try {
    admin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!admin) {
      admin = await User.create({
        email:                adminEmail.toLowerCase(),
        password_hash:        adminHash,
        role:                 'admin',
        is_active:            true,
        must_change_password: false,
      });
    }
  } catch (e) {
    if (e.code === 11000) admin = await User.findOne({ email: adminEmail.toLowerCase() });
    else throw e;
  }

  try {
    await createAuditLog({
      actor:     { _id: admin._id, email: admin.email, role: 'admin' },
      action:    'SYSTEM_INITIALIZATION',
      entity:    'System',
      entity_id: String(admin._id),
      after:     { company_name: settings.company_name, admin_email: admin.email },
    });
  } catch (_) {}

  // ── 7. HR user ───────────────────────────────────────────────────────────
  let hrUser = await User.findOne({ email: 'hr@hcmlite.com' });
  if (!hrUser) {
    hrUser = await User.create({
      email:                'hr@hcmlite.com',
      password_hash:        testHash,
      role:                 'hr',
      is_active:            true,
      must_change_password: false,
    });
  }

  // ── 8. Employees ─────────────────────────────────────────────────────────
  //
  //  Salary bands chosen to exercise ALL 5 tax slabs:
  //   Slab 0: annual gross ≤ 600k  → EMP0005 gross=45k/mo → annual=540k  → 0%
  //   Slab 1: 600k-1.2M            → EMP0004 gross=75k/mo → annual=900k  → 5%
  //   Slab 2: 1.2M-2.4M            → EMP0002 gross=120k   → annual=1.44M → 15%
  //   Slab 3: 2.4M-3.6M            → EMP0001 gross=195k   → annual=2.34M → 25%
  //   Slab 4: above 3.6M           → EMP0003 gross=300k   → annual=3.6M+ → 35%
  //
  //  Additional employees flesh out departments and dashboard stats.
  //
  const Employee = (await import('@/models/Employee')).default;

  /**
   * Helper: upsert one employee, return its document.
   * basic_salary → hra=40%, medical=10%, gross=1.5×
   */
  async function upsertEmployee(code, data) {
    const basic   = data.basic_salary;
    const hra     = Math.round(basic * 0.4);
    const medical = Math.round(basic * 0.1);
    const gross   = basic + hra + medical;  // = 1.5× basic  (M6 rule)

    let doc = await Employee.findOne({ employee_code: code });
    if (!doc) {
      doc = await Employee.create({
        employee_code:  code,
        first_name:     data.first_name,
        last_name:      data.last_name,
        email:          data.email,
        phone:          data.phone || '0300-0000000',
        address:        data.address || 'Karachi, Pakistan',
        gender:         data.gender,
        department_id:  DEPT[data.dept],
        designation_id: DES[data.des],
        joining_date:   new Date(data.joining_date),
        exit_date:      data.exit_date ? new Date(data.exit_date) : null,
        status:         data.status || 'active',
        basic_salary:   basic,
        hra,
        medical,
        gross_salary:   gross,
      });
    }
    return doc;
  }

  async function upsertUser(email, role, empId) {
    let u = await User.findOne({ email });
    if (!u) {
      u = await User.create({
        email,
        password_hash:        testHash,
        role,
        employee_id:          empId || null,
        is_active:            true,
        must_change_password: false,
      });
    }
    return u;
  }

  // ── The 12 seed employees ────────────────────────────────────────────────
  //
  // EMP0001 – John Doe       – ENG – 130k basic → 195k gross → Slab3  (tax 25%)
  //           → today: PRESENT (09:05 check-in)
  //           → primary test employee (employee@hcmlite.com)
  //
  // EMP0002 – Sarah Khan     – HR  – 80k basic  → 120k gross → Slab2  (tax 15%)
  //           → today: LATE (09:40 check-in, 25 min late)
  //
  // EMP0003 – Ali Ahmed      – FIN – 200k basic → 300k gross → Slab4  (tax 35%)
  //           → today: HALF_DAY (09:00 check-in, 12:30 check-out = 3.5h)
  //
  // EMP0004 – Fatima Noor    – MKT – 50k basic  → 75k gross  → Slab1  (tax 5%)
  //           → today: ON LEAVE (approved Casual Leave)
  //
  // EMP0005 – Bilal Hassan   – OPS – 30k basic  → 45k gross  → Slab0  (tax 0%)
  //           → today: ABSENT (no attendance, no approved leave)
  //
  // EMP0006 – Zara Sheikh    – ENG – 75k basic  → 112.5k gross → Slab2
  //           → today: PRESENT (missing_checkout - checked in, no checkout yet)
  //
  // EMP0007 – Usman Tariq    – FIN – 50k basic  → 75k gross  → Slab1
  //           → today: ON LEAVE (approved Sick Leave) – brief teaser: "3 casual, 2 sick"
  //
  // EMP0008 – Hira Malik     – MKT – 60k basic  → 90k gross  → Slab2
  //           → today: PRESENT (09:10 check-in)
  //
  // EMP0009 – Kamran Rao     – OPS – 45k basic  → 67.5k gross → Slab1
  //           → today: LATE (09:35 check-in)
  //
  // EMP0010 – Nadia Siddiqui – HR  – 55k basic  → 82.5k gross → Slab2
  //           → today: ON LEAVE (approved Casual Leave) – 3 casual  (emp4,8→ now emp4,10,11)
  //
  // EMP0011 – Omar Farooq    – ENG – 40k basic  → 60k gross  → Slab1
  //           → today: ON LEAVE (approved Casual Leave) – 3rd casual
  //
  // EMP0012 – Ayesha Qureshi – FIN – 90k basic  → 135k gross → Slab2
  //           → status: probation  (drives attrition / probation counts)
  //           → today: PRESENT
  //
  // (resigned employee for attrition YTD)
  // EMP0013 – Tariq Mehmood  – OPS – 35k basic  → resigned
  //
  const E = {};

  E['EMP0001'] = await upsertEmployee('EMP0001', {
    first_name: 'John',       last_name: 'Doe',      email: 'employee@hcmlite.com',
    gender: 'male', dept: 'ENG', des: 'Software Engineer', joining_date: '2025-06-01',
    basic_salary: 130000,
  });
  await upsertUser('employee@hcmlite.com', 'employee', E['EMP0001']._id);

  E['EMP0002'] = await upsertEmployee('EMP0002', {
    first_name: 'Sarah',      last_name: 'Khan',     email: 'sarah.khan@hcmlite.com',
    gender: 'female', dept: 'HR', des: 'HR Manager', joining_date: '2025-03-15',
    basic_salary: 80000,
  });
  await upsertUser('sarah.khan@hcmlite.com', 'employee', E['EMP0002']._id);

  E['EMP0003'] = await upsertEmployee('EMP0003', {
    first_name: 'Ali',        last_name: 'Ahmed',    email: 'ali.ahmed@hcmlite.com',
    gender: 'male', dept: 'FIN', des: 'Accountant', joining_date: '2024-11-01',
    basic_salary: 200000,
  });
  await upsertUser('ali.ahmed@hcmlite.com', 'employee', E['EMP0003']._id);

  E['EMP0004'] = await upsertEmployee('EMP0004', {
    first_name: 'Fatima',     last_name: 'Noor',     email: 'fatima.noor@hcmlite.com',
    gender: 'female', dept: 'MKT', des: 'Marketing Specialist', joining_date: '2026-01-15',
    basic_salary: 50000,
  });
  await upsertUser('fatima.noor@hcmlite.com', 'employee', E['EMP0004']._id);

  E['EMP0005'] = await upsertEmployee('EMP0005', {
    first_name: 'Bilal',      last_name: 'Hassan',   email: 'bilal.hassan@hcmlite.com',
    gender: 'male', dept: 'OPS', des: 'Operations Executive', joining_date: '2026-02-01',
    basic_salary: 30000,
  });
  await upsertUser('bilal.hassan@hcmlite.com', 'employee', E['EMP0005']._id);

  E['EMP0006'] = await upsertEmployee('EMP0006', {
    first_name: 'Zara',       last_name: 'Sheikh',   email: 'zara.sheikh@hcmlite.com',
    gender: 'female', dept: 'ENG', des: 'Senior Software Engineer', joining_date: '2024-08-01',
    basic_salary: 75000,
  });
  await upsertUser('zara.sheikh@hcmlite.com', 'employee', E['EMP0006']._id);

  E['EMP0007'] = await upsertEmployee('EMP0007', {
    first_name: 'Usman',      last_name: 'Tariq',    email: 'usman.tariq@hcmlite.com',
    gender: 'male', dept: 'FIN', des: 'Accountant', joining_date: '2025-09-01',
    basic_salary: 50000,
  });
  await upsertUser('usman.tariq@hcmlite.com', 'employee', E['EMP0007']._id);

  E['EMP0008'] = await upsertEmployee('EMP0008', {
    first_name: 'Hira',       last_name: 'Malik',    email: 'hira.malik@hcmlite.com',
    gender: 'female', dept: 'MKT', des: 'Marketing Specialist', joining_date: '2026-03-10',
    basic_salary: 60000,
  });
  await upsertUser('hira.malik@hcmlite.com', 'employee', E['EMP0008']._id);

  E['EMP0009'] = await upsertEmployee('EMP0009', {
    first_name: 'Kamran',     last_name: 'Rao',      email: 'kamran.rao@hcmlite.com',
    gender: 'male', dept: 'OPS', des: 'Operations Executive', joining_date: '2025-12-01',
    basic_salary: 45000,
  });
  await upsertUser('kamran.rao@hcmlite.com', 'employee', E['EMP0009']._id);

  E['EMP0010'] = await upsertEmployee('EMP0010', {
    first_name: 'Nadia',      last_name: 'Siddiqui', email: 'nadia.siddiqui@hcmlite.com',
    gender: 'female', dept: 'HR', des: 'HR Manager', joining_date: '2025-07-01',
    basic_salary: 55000,
  });
  await upsertUser('nadia.siddiqui@hcmlite.com', 'employee', E['EMP0010']._id);

  E['EMP0011'] = await upsertEmployee('EMP0011', {
    first_name: 'Omar',       last_name: 'Farooq',   email: 'omar.farooq@hcmlite.com',
    gender: 'male', dept: 'ENG', des: 'Software Engineer', joining_date: '2026-04-01',
    basic_salary: 40000,
  });
  await upsertUser('omar.farooq@hcmlite.com', 'employee', E['EMP0011']._id);

  E['EMP0012'] = await upsertEmployee('EMP0012', {
    first_name: 'Ayesha',     last_name: 'Qureshi',  email: 'ayesha.qureshi@hcmlite.com',
    gender: 'female', dept: 'FIN', des: 'Accountant', joining_date: '2026-09-01',
    status: 'probation', basic_salary: 90000,
  });
  await upsertUser('ayesha.qureshi@hcmlite.com', 'employee', E['EMP0012']._id);

  // Resigned employee – drives attrition YTD metric
  E['EMP0013'] = await upsertEmployee('EMP0013', {
    first_name: 'Tariq',      last_name: 'Mehmood',  email: 'tariq.mehmood@hcmlite.com',
    gender: 'male', dept: 'OPS', des: 'Operations Executive',
    joining_date: '2025-01-01', exit_date: '2026-08-31',
    status: 'resigned', basic_salary: 35000,
  });

  // ── 9. Today's Attendance (M4 – all 6 statuses) ──────────────────────────
  const Attendance = (await import('@/models/Attendance')).default;

  // Helper: upsert today's attendance safely
  async function upsertTodayAtt(empId, data) {
    const exists = await Attendance.findOne({ employee_id: empId, date: todayStr });
    if (!exists) await Attendance.create({ employee_id: empId, date: todayStr, ...data });
  }

  // EMP0001 – PRESENT (09:05, full 8.5 h)
  await upsertTodayAtt(E['EMP0001']._id, {
    check_in: isoAt(todayStr, '09:05:00'), check_out: isoAt(todayStr, '17:35:00'),
    worked_hours: 8.5, is_late: false, late_minutes: 0, status: 'present',
    remarks: 'On time – full day',
  });

  // EMP0002 – LATE (09:40, 25 min late, still full day)
  await upsertTodayAtt(E['EMP0002']._id, {
    check_in: isoAt(todayStr, '09:40:00'), check_out: isoAt(todayStr, '18:10:00'),
    worked_hours: 8.5, is_late: true, late_minutes: 25, status: 'late',
    remarks: 'Late arrival – traffic',
  });

  // EMP0003 – HALF_DAY (09:00 in, 12:30 out = 3.5 h < 5 h threshold)
  await upsertTodayAtt(E['EMP0003']._id, {
    check_in: isoAt(todayStr, '09:00:00'), check_out: isoAt(todayStr, '12:30:00'),
    worked_hours: 3.5, is_late: false, late_minutes: 0, status: 'half_day',
    remarks: 'Partial day – early exit',
  });

  // EMP0004 – ON LEAVE (approved Casual Leave – no attendance record created, leave below)

  // EMP0005 – ABSENT (no attendance record, no approved leave – pure absent)

  // EMP0006 – MISSING_CHECKOUT (checked in, never checked out today)
  await upsertTodayAtt(E['EMP0006']._id, {
    check_in: isoAt(todayStr, '09:08:00'), check_out: null,
    worked_hours: 0, is_late: false, late_minutes: 0, status: 'missing_checkout',
    remarks: 'Forgot to check out',
  });

  // EMP0007 – ON LEAVE (approved Sick Leave – no attendance)

  // EMP0008 – PRESENT (09:10, slightly early, full 8 h)
  await upsertTodayAtt(E['EMP0008']._id, {
    check_in: isoAt(todayStr, '09:10:00'), check_out: isoAt(todayStr, '17:10:00'),
    worked_hours: 8.0, is_late: false, late_minutes: 0, status: 'present',
    remarks: 'On time',
  });

  // EMP0009 – LATE (09:35, 20 min late)
  await upsertTodayAtt(E['EMP0009']._id, {
    check_in: isoAt(todayStr, '09:35:00'), check_out: isoAt(todayStr, '17:35:00'),
    worked_hours: 8.0, is_late: true, late_minutes: 20, status: 'late',
    remarks: 'Late – car issue',
  });

  // EMP0010 – ON LEAVE (approved Casual Leave)
  // EMP0011 – ON LEAVE (approved Casual Leave)

  // EMP0012 – PRESENT (probation employee, on time)
  await upsertTodayAtt(E['EMP0012']._id, {
    check_in: isoAt(todayStr, '09:00:00'), check_out: isoAt(todayStr, '17:00:00'),
    worked_hours: 8.0, is_late: false, late_minutes: 0, status: 'present',
    remarks: 'Probation – on time',
  });

  // ── 10. 30-day attendance history (for trend charts) ──────────────────────
  // We'll seed history for EMP0001 to drive a realistic 30-day trend
  const attCount = await Attendance.countDocuments({ employee_id: E['EMP0001']._id });
  if (attCount <= 1) {
    // Pattern for last 30 working days (skip weekends)
    const pattern = [
      'present','present','late','present','absent',
      'present','half_day','present','late','present',
      'present','present','late','present','present',
      'half_day','present','present','present','absent',
      'late','present','present','present','present',
      'present','late','half_day','present','present',
    ];
    let pIdx = 0;
    for (let i = 30; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      const dStr = ymd(d);
      const exists = await Attendance.findOne({ employee_id: E['EMP0001']._id, date: dStr });
      if (!exists) {
        const s = pattern[pIdx % pattern.length];
        pIdx++;
        if (s === 'absent') continue; // absent = no record
        const isLate      = s === 'late';
        const isHalfDay   = s === 'half_day';
        const checkInTime = isLate ? '09:35:00' : '09:05:00';
        const workedHrs   = isHalfDay ? 3.5 : 8.5;
        const checkOutTime= isHalfDay ? '12:35:00' : '17:35:00';
        await Attendance.create({
          employee_id:  E['EMP0001']._id,
          date:         dStr,
          check_in:     isoAt(dStr, checkInTime),
          check_out:    isoAt(dStr, checkOutTime),
          worked_hours: workedHrs,
          is_late:      isLate,
          late_minutes: isLate ? 20 : 0,
          status:       s,
        });
      }
    }
  }

  // Brief: "3 lates = 0.5-day deduction" bonus rule
  // EMP0009 gets 3 late marks (today + 2 past) to demonstrate the rule
  const kamranPastLates = [daysAgo(2), daysAgo(4)];
  for (const dStr of kamranPastLates) {
    const d = new Date(dStr);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const ex = await Attendance.findOne({ employee_id: E['EMP0009']._id, date: dStr });
    if (!ex) {
      await Attendance.create({
        employee_id: E['EMP0009']._id, date: dStr,
        check_in:     isoAt(dStr, '09:38:00'),
        check_out:    isoAt(dStr, '17:38:00'),
        worked_hours: 8.0, is_late: true, late_minutes: 23,
        status: 'late',
        remarks: '3-late rule: this is late #' + (kamranPastLates.indexOf(dStr) + 1),
      });
    }
  }

  // ── 11. Leave requests (M5 – all statuses + all leave types) ─────────────
  const LeaveRequest = (await import('@/models/LeaveRequest')).default;

  async function upsertLeave(empId, data) {
    const exists = await LeaveRequest.findOne({
      employee_id: empId, leave_type_id: data.leave_type_id,
      start_date: data.start_date, status: data.status,
    });
    if (!exists) await LeaveRequest.create({ employee_id: empId, ...data });
  }

  // EMP0004 – today: APPROVED CASUAL LEAVE  (casual count: 1)
  await upsertLeave(E['EMP0004']._id, {
    leave_type_id: LT['CASUAL']._id,
    start_date: todayStr, end_date: todayStr,
    working_days: 1,
    reason: 'Urgent personal errand',
    status: 'approved',
    reviewed_by: hrUser._id,
    review_comment: 'Approved. Take care.',
  });

  // EMP0007 – today: APPROVED SICK LEAVE  (sick count: 1)
  await upsertLeave(E['EMP0007']._id, {
    leave_type_id: LT['SICK']._id,
    start_date: todayStr, end_date: todayStr,
    working_days: 1,
    reason: 'High fever, doctor recommended rest',
    status: 'approved',
    reviewed_by: hrUser._id,
    review_comment: 'Get well soon.',
  });

  // EMP0010 – today: APPROVED CASUAL LEAVE  (casual count: 2)
  await upsertLeave(E['EMP0010']._id, {
    leave_type_id: LT['CASUAL']._id,
    start_date: todayStr, end_date: todayStr,
    working_days: 1,
    reason: 'Family function',
    status: 'approved',
    reviewed_by: hrUser._id,
    review_comment: 'Approved.',
  });

  // EMP0011 – today: APPROVED CASUAL LEAVE  (casual count: 3 – matches "3 casual" in brief teaser)
  await upsertLeave(E['EMP0011']._id, {
    leave_type_id: LT['CASUAL']._id,
    start_date: todayStr, end_date: todayStr,
    working_days: 1,
    reason: 'Home renovation – had to supervise',
    status: 'approved',
    reviewed_by: hrUser._id,
    review_comment: 'Approved.',
  });

  // EMP0001 – PENDING ANNUAL LEAVE (next week – for HR approval inbox)
  await upsertLeave(E['EMP0001']._id, {
    leave_type_id: LT['ANNUAL']._id,
    start_date: daysFromNow(6), end_date: daysFromNow(7),
    working_days: 2,
    reason: 'Family trip planned in advance',
    status: 'pending',
  });

  // EMP0002 – APPROVED SICK LEAVE (3 days ago – past; sick count: 2 matching brief "2 sick" total across week)
  await upsertLeave(E['EMP0002']._id, {
    leave_type_id: LT['SICK']._id,
    start_date: daysAgo(7), end_date: daysAgo(5),
    working_days: 3,
    reason: 'Flu and viral infection',
    status: 'approved',
    reviewed_by: hrUser._id,
    review_comment: 'Approved. Rest well.',
  });

  // EMP0003 – REJECTED ANNUAL LEAVE (was rejected due to busy period)
  await upsertLeave(E['EMP0003']._id, {
    leave_type_id: LT['ANNUAL']._id,
    start_date: daysAgo(14), end_date: daysAgo(12),
    working_days: 3,
    reason: 'Vacation with family',
    status: 'rejected',
    reviewed_by: hrUser._id,
    review_comment: 'Sorry, month-end close is happening. Try in November.',
  });

  // EMP0003 – PENDING LEAVE (next week – for HR pending count ≥ 2)
  await upsertLeave(E['EMP0003']._id, {
    leave_type_id: LT['ANNUAL']._id,
    start_date: daysFromNow(5), end_date: daysFromNow(5),
    working_days: 1,
    reason: 'Annual family holiday',
    status: 'pending',
  });

  // EMP0005 – CANCELLED LEAVE (cancelled their own leave)
  await upsertLeave(E['EMP0005']._id, {
    leave_type_id: LT['CASUAL']._id,
    start_date: daysAgo(3), end_date: daysAgo(3),
    working_days: 1,
    reason: 'Personal work',
    status: 'cancelled',
    review_comment: 'Employee cancelled.',
  });

  // EMP0006 – UNPAID LEAVE (exhausted all casual, applied unpaid)
  await upsertLeave(E['EMP0006']._id, {
    leave_type_id: LT['UNPAID']._id,
    start_date: daysFromNow(10), end_date: daysFromNow(11),
    working_days: 2,
    reason: 'Extended family emergency',
    status: 'pending',
  });

  // EMP0009 – APPROVED ANNUAL LEAVE (past – already used some quota)
  await upsertLeave(E['EMP0009']._id, {
    leave_type_id: LT['ANNUAL']._id,
    start_date: daysAgo(20), end_date: daysAgo(18),
    working_days: 3,
    reason: 'Eid holidays extension',
    status: 'approved',
    reviewed_by: hrUser._id,
    review_comment: 'Approved.',
  });

  // ── 12. Attendance Corrections (M4 – request + approve/reject) ───────────
  const AttendanceCorrection = (await import('@/models/AttendanceCorrection')).default;

  // EMP0005 – pending correction (absent yesterday, claims system glitch)
  const correctionDate = daysAgo(1);
  const corrExists1 = await AttendanceCorrection.findOne({
    employee_id: E['EMP0005']._id, date: correctionDate,
  });
  if (!corrExists1) {
    await AttendanceCorrection.create({
      employee_id:        E['EMP0005']._id,
      attendance_id:      null,
      date:               correctionDate,
      proposed_check_in:  isoAt(correctionDate, '09:00:00'),
      proposed_check_out: isoAt(correctionDate, '17:00:00'),
      reason:             'System did not record my check-in – I was physically present',
      status:             'pending',
    });
  }

  // EMP0002 – approved correction (was marked missing_checkout last week)
  const corrDate2    = daysAgo(8);
  const corrExists2  = await AttendanceCorrection.findOne({
    employee_id: E['EMP0002']._id, date: corrDate2,
  });
  if (!corrExists2) {
    await AttendanceCorrection.create({
      employee_id:        E['EMP0002']._id,
      attendance_id:      null,
      date:               corrDate2,
      proposed_check_in:  isoAt(corrDate2, '09:05:00'),
      proposed_check_out: isoAt(corrDate2, '17:30:00'),
      reason:             'Forgot to check out before leaving office',
      status:             'approved',
      reviewed_by:        hrUser._id,
      review_comment:     'Corrected. Please remember to check out.',
    });
  }

  // EMP0001 – rejected correction (tried to change late mark)
  const corrDate3   = daysAgo(5);
  const corrExists3 = await AttendanceCorrection.findOne({
    employee_id: E['EMP0001']._id, date: corrDate3,
  });
  if (!corrExists3) {
    await AttendanceCorrection.create({
      employee_id:        E['EMP0001']._id,
      attendance_id:      null,
      date:               corrDate3,
      proposed_check_in:  isoAt(corrDate3, '09:10:00'),
      proposed_check_out: isoAt(corrDate3, '17:35:00'),
      reason:             'My check-in was logged late due to slow network in lobby',
      status:             'rejected',
      reviewed_by:        hrUser._id,
      review_comment:     'Server stamps time on receipt – cannot override.',
    });
  }

  // ── 13. Payroll runs (M6) ─────────────────────────────────────────────────
  const Payroll = (await import('@/models/Payroll')).default;

  const WORKING_DAYS = 22; // standard month

  // Active employees whose payroll we seed
  const payrollEmps = [
    'EMP0001','EMP0002','EMP0003','EMP0004','EMP0005',
    'EMP0006','EMP0007','EMP0008','EMP0009','EMP0010','EMP0011','EMP0012',
  ];

  // Absence summary for current month (for deduction)
  const absenceCurrent = {
    EMP0001: { worked: 21, absent: 0, half: 0, unpaid: 0 },
    EMP0002: { worked: 20, absent: 0, half: 0, unpaid: 0 },  // had sick leave (paid)
    EMP0003: { worked: 20, absent: 0, half: 1, unpaid: 0 },  // half day today
    EMP0004: { worked: 21, absent: 0, half: 0, unpaid: 0 },  // casual (paid)
    EMP0005: { worked: 19, absent: 2, half: 0, unpaid: 0 },  // 2 absent days
    EMP0006: { worked: 21, absent: 0, half: 0, unpaid: 0 },
    EMP0007: { worked: 21, absent: 0, half: 0, unpaid: 0 },  // sick (paid)
    EMP0008: { worked: 21, absent: 0, half: 0, unpaid: 0 },
    EMP0009: { worked: 20, absent: 0, half: 0, unpaid: 0 },  // has 3-lates → 0.5 day deduction
    EMP0010: { worked: 21, absent: 0, half: 0, unpaid: 0 },
    EMP0011: { worked: 21, absent: 0, half: 0, unpaid: 0 },
    EMP0012: { worked: 22, absent: 0, half: 0, unpaid: 0 },
  };

  for (const code of payrollEmps) {
    const emp = E[code];
    if (!emp) continue;
    const abs = absenceCurrent[code] || { worked: 21, absent: 0, half: 0, unpaid: 0 };
    const existsCurr = await Payroll.findOne({ employee_id: emp._id, month: currentMonth });
    if (!existsCurr) {
      await Payroll.create({
        ...buildPayroll(emp, WORKING_DAYS, abs.worked, abs.absent, abs.half, abs.unpaid, currentMonth),
        status: 'draft',
      });
    }
  }

  // Last month – FINALIZED (only admin can finalize; drives payroll cost metrics)
  for (const code of payrollEmps) {
    const emp = E[code];
    if (!emp) continue;
    const existsLast = await Payroll.findOne({ employee_id: emp._id, month: lastMonth });
    if (!existsLast) {
      await Payroll.create({
        ...buildPayroll(emp, WORKING_DAYS, 21, 0, 0, 0, lastMonth),
        status: 'finalized',
        finalized_by: admin._id,
        finalized_at: new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 1),
      });
    }
  }

  // ── 14. Announcements (M9) ────────────────────────────────────────────────
  const Announcement = (await import('@/models/Announcement')).default;

  const annCount = await Announcement.countDocuments();
  if (annCount === 0) {
    await Announcement.create([
      {
        title: '🎉 Welcome to HCM Lite!',
        content: 'Our new AI-powered Human Capital Management system is live. All employees can now check in, apply for leave, and view payslips directly from the portal. Reach out to HR for any questions.',
        author_id: admin._id,
        target_role: 'all',
      },
      {
        title: '📢 October Payroll Processing',
        content: 'HR is processing October payroll. Please ensure all attendance corrections and leave requests are submitted before 28th October 2026. Payslips will be available by 1st November.',
        author_id: hrUser._id,
        target_role: 'all',
      },
      {
        title: '🕘 Reminder: Office Hours Policy',
        content: 'Office hours are 09:00 – 18:00, Monday to Friday. Grace period is 15 minutes (09:15 deadline). After 3 late arrivals in a month, 0.5 day will be deducted from your casual leave balance.',
        author_id: admin._id,
        target_role: 'employee',
      },
    ]);
  }

  // ── 15. Audit log entries (M9) ────────────────────────────────────────────
  // Extra audit entries for the admin audit log viewer
  try {
    await createAuditLog({
      actor: { _id: hrUser._id, email: 'hr@hcmlite.com', role: 'hr' },
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entity_id: String(E['EMP0001']._id),
      after: { employee_code: 'EMP0001', name: 'John Doe', dept: 'Engineering' },
    });
    await createAuditLog({
      actor: { _id: hrUser._id, email: 'hr@hcmlite.com', role: 'hr' },
      action: 'LEAVE_APPROVED',
      entity: 'LeaveRequest',
      entity_id: 'seed-leave-emp004',
      after: { employee: 'Fatima Noor', type: 'Casual', date: todayStr },
    });
    await createAuditLog({
      actor: { _id: admin._id, email: adminEmail, role: 'admin' },
      action: 'PAYROLL_FINALIZED',
      entity: 'Payroll',
      entity_id: `payroll-${lastMonth}`,
      after: { month: lastMonth, status: 'finalized', total_employees: payrollEmps.length },
    });
  } catch (_) {}

  return admin;
}
