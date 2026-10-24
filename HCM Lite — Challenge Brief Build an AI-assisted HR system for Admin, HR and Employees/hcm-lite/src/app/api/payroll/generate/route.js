import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import LeaveRequest from '@/models/LeaveRequest';
import Payroll from '@/models/Payroll';
import CompanySettings from '@/models/CompanySettings';
import Holiday from '@/models/Holiday';
import { calculateWorkingDays, calculateMonthlyTax } from '@/lib/business-rules';
import { createAuditLog } from '@/lib/audit';

export async function POST(req) {
  try {
    // HR or Admin creates payroll draft
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await req.json();
    const { month } = body; // "YYYY-MM"

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Valid month (YYYY-MM) is required' },
        { status: 400 }
      );
    }

    // Check if payroll for this month has ALREADY BEEN FINALIZED
    const finalizedCheck = await Payroll.findOne({ month, status: 'finalized' });
    if (finalizedCheck) {
      return NextResponse.json(
        {
          error: `Payroll for ${month} is already finalized and locked. It cannot be regenerated.`,
        },
        { status: 403 }
      );
    }

    const settings = (await CompanySettings.findOne()) || { weekend_days: [0, 6] };

    // Month boundary dates
    const [yearStr, monthNumStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthNumStr, 10);
    const firstDay = `${month}-01`;
    const lastDayDate = new Date(year, monthNum, 0); // last day of month
    const lastDay = `${month}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

    // Get holidays this month
    const holidays = await Holiday.find({
      date: { $gte: firstDay, $lte: lastDay },
    });
    const holidayDates = holidays.map((h) => h.date);

    // Calculate total standard working days in the month
    const totalWorkingDaysInMonth = calculateWorkingDays(
      firstDay,
      lastDay,
      settings.weekend_days,
      holidayDates
    );

    const activeEmployees = await Employee.find({
      status: { $in: ['active', 'probation'] },
      joining_date: { $lte: lastDayDate },
    });

    const payrollDrafts = [];

    for (const emp of activeEmployees) {
      const basic = emp.basic_salary || 0;
      const hra = emp.hra || Math.round(basic * 0.4);
      const medical = emp.medical || Math.round(basic * 0.1);
      const gross = basic + hra + medical; // 1.5 * basic

      const perDaySalary = totalWorkingDaysInMonth > 0 ? gross / totalWorkingDaysInMonth : 0;

      // 1. Fetch employee attendance for this month
      const attendance = await Attendance.find({
        employee_id: emp._id,
        date: { $gte: firstDay, $lte: lastDay },
      });

      const presentRecords = attendance.filter((a) => a.status === 'present' || a.status === 'late');
      const halfDayRecords = attendance.filter((a) => a.status === 'half_day');

      // 2. Fetch employee approved leaves for this month
      const leaves = await LeaveRequest.find({
        employee_id: emp._id,
        status: 'approved',
        start_date: { $lte: lastDay },
        end_date: { $gte: firstDay },
      }).populate('leave_type_id');

      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;

      leaves.forEach((l) => {
        const isPaid = l.leave_type_id ? l.leave_type_id.is_paid : true;
        if (isPaid) {
          paidLeaveDays += l.working_days || 0;
        } else {
          unpaidLeaveDays += l.working_days || 0;
        }
      });

      // 3. Compute working days applicable for joiners / leavers
      let empExpectedWorkingDays = totalWorkingDaysInMonth;
      const empJoinStr = emp.joining_date.toISOString().split('T')[0];
      if (empJoinStr > firstDay) {
        // Joined mid-month, prorate expected working days
        empExpectedWorkingDays = calculateWorkingDays(
          empJoinStr,
          lastDay,
          settings.weekend_days,
          holidayDates
        );
      }

      // 4. Compute Absent days
      // Absent days = Expected working days - (present + late + half_days + paid_leave + unpaid_leave)
      const accountedDays =
        presentRecords.length + halfDayRecords.length + paidLeaveDays + unpaidLeaveDays;
      const absentDays = Math.max(0, empExpectedWorkingDays - accountedDays);

      // 5. Compute Deductions per business rules:
      // deduct absent days + unpaid leave days + 0.5 * half days
      const halfDaysCount = halfDayRecords.length;
      const absenceDeduction = Math.round(
        (absentDays * perDaySalary + unpaidLeaveDays * perDaySalary + halfDaysCount * 0.5 * perDaySalary) * 100
      ) / 100;

      // 6. Tax calculation per slab
      const monthlyTax = calculateMonthlyTax(gross);

      // 7. Net salary
      const netSalary = Math.max(0, Math.round((gross - absenceDeduction - monthlyTax) * 100) / 100);

      // Upsert draft record (only if not finalized)
      const existingDraft = await Payroll.findOne({ month, employee_id: emp._id });
      if (existingDraft && existingDraft.status === 'finalized') {
        continue;
      }

      const payrollItem = await Payroll.findOneAndUpdate(
        { month, employee_id: emp._id },
        {
          month,
          employee_id: emp._id,
          basic_salary: basic,
          hra,
          medical,
          gross_salary: gross,
          working_days_in_month: totalWorkingDaysInMonth,
          worked_days: presentRecords.length + halfDaysCount,
          absent_days: absentDays,
          unpaid_leave_days: unpaidLeaveDays,
          half_days: halfDaysCount,
          per_day_salary: Math.round(perDaySalary * 100) / 100,
          absence_deduction: absenceDeduction,
          tax_deduction: monthlyTax,
          net_salary: netSalary,
          status: 'draft',
        },
        { upsert: true, new: true }
      );

      payrollDrafts.push(payrollItem);
    }

    await createAuditLog({
      actor: { _id: user._id, email: user.email, role: user.role },
      action: 'GENERATE_PAYROLL_DRAFT',
      entity: 'Payroll',
      after: { month, count: payrollDrafts.length },
    });

    return NextResponse.json({
      success: true,
      month,
      count: payrollDrafts.length,
      message: `Generated payroll draft for ${month} with ${payrollDrafts.length} employees`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
