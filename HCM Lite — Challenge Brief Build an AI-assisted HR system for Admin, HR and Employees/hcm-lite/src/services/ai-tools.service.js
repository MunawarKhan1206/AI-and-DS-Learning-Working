import { connectDB } from '../lib/db.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveType from '../models/LeaveType.js';
import Payroll from '../models/Payroll.js';
import { formatDate } from '../lib/business-rules.js';

/**
 * Executes a tool called by the LLM, strictly enforcing the caller's role & permissions.
 */
export async function executeTool(toolName, args, user) {
  await connectDB();
  const callerRole = user.role;
  const callerEmpId = user.employee_id ? String(user.employee_id._id || user.employee_id) : null;
  const todayStr = formatDate(new Date());

  switch (toolName) {
    case 'get_headcount': {
      if (callerRole === 'employee') {
        const count = await Employee.countDocuments({ status: { $in: ['active', 'probation'] } });
        return { totalActiveHeadcount: count };
      }
      const active = await Employee.countDocuments({ status: 'active' });
      const probation = await Employee.countDocuments({ status: 'probation' });
      const resigned = await Employee.countDocuments({ status: 'resigned' });
      return { totalActive: active + probation, active, probation, resigned };
    }

    case 'get_attendance_summary': {
      const activeEmployees = await Employee.countDocuments({ status: { $in: ['active', 'probation'] } });
      const records = await Attendance.find({ date: todayStr });
      const present = records.filter((r) => r.status === 'present').length;
      const late = records.filter((r) => r.is_late || r.status === 'late').length;
      const halfDay = records.filter((r) => r.status === 'half_day').length;

      return {
        date: todayStr,
        totalHeadcount: activeEmployees,
        checkedIn: records.length,
        present,
        late,
        halfDay,
      };
    }

    case 'get_late_comers': {
      if (callerRole === 'employee') {
        return { error: 'Permission Denied: Only HR and Admin can view company late-comers.' };
      }
      const records = await Attendance.find({ date: todayStr, is_late: true })
        .populate('employee_id', 'employee_code first_name last_name')
        .limit(10);

      return {
        count: records.length,
        lateComers: records.map((r) => ({
          name: `${r.employee_id?.first_name} ${r.employee_id?.last_name}`,
          code: r.employee_id?.employee_code,
          lateMinutes: r.late_minutes,
          checkIn: r.check_in,
        })),
      };
    }

    case 'get_leave_summary': {
      const pending = await LeaveRequest.countDocuments({ status: 'pending' });
      const onLeaveToday = await LeaveRequest.countDocuments({
        status: 'approved',
        start_date: { $lte: todayStr },
        end_date: { $gte: todayStr },
      });
      return { onLeaveToday, pendingApprovals: pending };
    }

    case 'get_my_leave_balance': {
      if (!callerEmpId) {
        return { error: 'No employee account associated with user.' };
      }
      const leaveTypes = await LeaveType.find({ is_active: true });
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const balances = await Promise.all(
        leaveTypes.map(async (lt) => {
          const approved = await LeaveRequest.find({
            employee_id: callerEmpId,
            leave_type_id: lt._id,
            status: 'approved',
            start_date: { $gte: yearStart, $lte: yearEnd },
          });
          const used = approved.reduce((acc, l) => acc + (l.working_days || 0), 0);
          return {
            name: lt.name,
            code: lt.code,
            quota: lt.quota,
            used,
            remaining: lt.quota >= 999 ? 'Unlimited' : Math.max(0, lt.quota - used),
          };
        })
      );
      return { balances };
    }

    case 'get_payroll_summary': {
      // SECURITY GUARDRAIL ENFORCED AT TOOL LAYER:
      // Employees are strictly prohibited from viewing payroll summaries or colleague salaries!
      if (callerRole === 'employee') {
        return {
          refusal: true,
          message:
            'Security Refusal: As an employee, you do not have permission to view company-wide payroll or colleague salary information. You may only view your own finalized payslips in your personal dashboard.',
        };
      }

      const month = args.month || new Date().toISOString().substring(0, 7);
      const records = await Payroll.find({ month });
      const totalGross = records.reduce((acc, r) => acc + (r.gross_salary || 0), 0);
      const totalNet = records.reduce((acc, r) => acc + (r.net_salary || 0), 0);
      const totalTax = records.reduce((acc, r) => acc + (r.tax_deduction || 0), 0);
      const isFinalized = records.length > 0 && records.every((r) => r.status === 'finalized');

      return {
        month,
        employeeCount: records.length,
        totalGross,
        totalNet,
        totalTax,
        isFinalized,
      };
    }

    case 'search_employees': {
      const search = args.query || '';
      const query = { status: { $in: ['active', 'probation'] } };
      if (search) {
        query.$or = [
          { first_name: { $regex: search, $options: 'i' } },
          { last_name: { $regex: search, $options: 'i' } },
          { employee_code: { $regex: search, $options: 'i' } },
        ];
      }

      // Hide salary fields if caller is an employee
      const projection =
        callerRole === 'employee'
          ? { basic_salary: 0, hra: 0, medical: 0, gross_salary: 0, bank_account: 0 }
          : {};

      const employees = await Employee.find(query, projection)
        .populate('department_id', 'name code')
        .populate('designation_id', 'title')
        .limit(10);

      return {
        count: employees.length,
        employees: employees.map((e) => ({
          name: `${e.first_name} ${e.last_name}`,
          code: e.employee_code,
          email: e.email,
          department: e.department_id?.name || 'N/A',
          designation: e.designation_id?.title || 'N/A',
        })),
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
