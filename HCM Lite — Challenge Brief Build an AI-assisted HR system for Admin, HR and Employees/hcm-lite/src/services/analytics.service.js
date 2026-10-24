import { connectDB } from '../lib/db.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveType from '../models/LeaveType.js';
import Payroll from '../models/Payroll.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import CompanySettings from '../models/CompanySettings.js';
import Holiday from '../models/Holiday.js';
import { calculateWorkingDays, formatDate } from '../lib/business-rules.js';

/**
 * Returns Admin dashboard analytics metrics
 */
export async function getAdminAnalytics({ departmentId = '', startDate = '', endDate = '' } = {}) {
  await connectDB();

  const now = new Date();
  const currentMonthStr = now.toISOString().substring(0, 7);
  const startYear = `${now.getFullYear()}-01-01`;
  const endYear = `${now.getFullYear()}-12-31`;

  const empFilter = {};
  if (departmentId) empFilter.department_id = departmentId;

  // 1. Headcount & Gender distribution
  const allEmployees = await Employee.find(empFilter).populate('department_id', 'name code');
  const activeEmployees = allEmployees.filter((e) => e.status === 'active' || e.status === 'probation');
  const headcount = activeEmployees.length;

  const genderBreakdown = {
    male: activeEmployees.filter((e) => e.gender === 'male').length,
    female: activeEmployees.filter((e) => e.gender === 'female').length,
    other: activeEmployees.filter((e) => e.gender === 'other').length,
  };

  // 2. Headcount by Department
  const deptCountMap = {};
  activeEmployees.forEach((e) => {
    const dName = e.department_id?.name || 'Unassigned';
    deptCountMap[dName] = (deptCountMap[dName] || 0) + 1;
  });
  const headcountByDept = Object.entries(deptCountMap).map(([department, count]) => ({
    department,
    count,
  }));

  // 3. Attrition YTD = (exits in period / average headcount) * 100
  const exitsYTD = await Employee.countDocuments({
    ...empFilter,
    status: { $in: ['resigned', 'terminated'] },
    exit_date: { $gte: new Date(startYear), $lte: new Date(endYear) },
  });
  const avgHeadcount = headcount > 0 ? (headcount + exitsYTD) / 2 : 1;
  const attritionYTD = Math.round((exitsYTD / avgHeadcount) * 100 * 10) / 10;

  // 4. Payroll cost and Avg Salary
  const payrollQuery = {};
  if (currentMonthStr) payrollQuery.month = currentMonthStr;

  const payrollRecords = await Payroll.find(payrollQuery).populate({
    path: 'employee_id',
    populate: [{ path: 'department_id' }, { path: 'designation_id' }],
  });

  const filteredPayroll = departmentId
    ? payrollRecords.filter((p) => String(p.employee_id?.department_id?._id) === departmentId)
    : payrollRecords;

  const totalGrossPayroll = filteredPayroll.reduce((acc, p) => acc + (p.gross_salary || 0), 0);
  const totalNetPayroll = filteredPayroll.reduce((acc, p) => acc + (p.net_salary || 0), 0);
  const avgSalary =
    activeEmployees.length > 0
      ? Math.round(
          activeEmployees.reduce((acc, e) => acc + (e.gross_salary || 0), 0) /
            activeEmployees.length
        )
      : 0;

  // 5. Payroll cost by Department
  const deptPayrollMap = {};
  filteredPayroll.forEach((p) => {
    const dName = p.employee_id?.department_id?.name || 'Unassigned';
    deptPayrollMap[dName] = (deptPayrollMap[dName] || 0) + (p.gross_salary || 0);
  });
  const payrollCostByDept = Object.entries(deptPayrollMap).map(([department, totalGross]) => ({
    department,
    totalGross,
  }));

  // 6. Avg Salary by Department & Designation
  const salaryByDeptMap = {};
  activeEmployees.forEach((e) => {
    const dName = e.department_id?.name || 'Unassigned';
    if (!salaryByDeptMap[dName]) salaryByDeptMap[dName] = { total: 0, count: 0 };
    salaryByDeptMap[dName].total += e.gross_salary || 0;
    salaryByDeptMap[dName].count += 1;
  });
  const avgSalaryByDept = Object.entries(salaryByDeptMap).map(([department, data]) => ({
    department,
    avgGross: Math.round(data.total / data.count),
  }));

  return {
    headcount,
    attritionYTD,
    totalGrossPayroll,
    totalNetPayroll,
    avgSalary,
    genderBreakdown,
    headcountByDept,
    payrollCostByDept,
    avgSalaryByDept,
  };
}

/**
 * Returns HR dashboard analytics metrics
 */
export async function getHRAnalytics({ departmentId = '', date = '' } = {}) {
  await connectDB();

  const todayStr = date || formatDate(new Date());

  const empFilter = { status: { $in: ['active', 'probation'] } };
  if (departmentId) empFilter.department_id = departmentId;

  const activeEmployees = await Employee.find(empFilter).populate('department_id', 'name code');
  const headcount = activeEmployees.length;
  const empIds = activeEmployees.map((e) => e._id);

  // Today's attendance
  const todayAttendance = await Attendance.find({
    employee_id: { $in: empIds },
    date: todayStr,
  }).populate('employee_id', 'first_name last_name employee_code');

  const presentCount = todayAttendance.filter((a) => a.status === 'present').length;
  const lateTodayCount = todayAttendance.filter((a) => a.is_late || a.status === 'late').length;
  const halfDayToday = todayAttendance.filter((a) => a.status === 'half_day').length;

  // On leave today
  const onLeaveToday = await LeaveRequest.find({
    employee_id: { $in: empIds },
    status: 'approved',
    start_date: { $lte: todayStr },
    end_date: { $gte: todayStr },
  });

  const onLeaveCount = onLeaveToday.length;
  const pendingLeaves = await LeaveRequest.countDocuments({ status: 'pending' });

  // Attendance Rate = (present + late + missing_checkout + 0.5*half_day) / (working-day records - on_leave)
  const totalCheckedIn = presentCount + lateTodayCount + 0.5 * halfDayToday;
  const denominator = Math.max(1, headcount - onLeaveCount);
  const attendanceRate = Math.round((totalCheckedIn / denominator) * 100 * 10) / 10;

  // Late % = late / (present + late)
  const latePercent =
    presentCount + lateTodayCount > 0
      ? Math.round((lateTodayCount / (presentCount + lateTodayCount)) * 100 * 10) / 10
      : 0;

  // Top 5 Late-comers (past 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);

  const lateRecords = await Attendance.find({
    employee_id: { $in: empIds },
    is_late: true,
    date: { $gte: thirtyDaysAgoStr },
  }).populate('employee_id', 'first_name last_name employee_code');

  const lateFrequency = {};
  lateRecords.forEach((r) => {
    if (!r.employee_id) return;
    const key = `${r.employee_id.first_name} ${r.employee_id.last_name} (${r.employee_id.employee_code})`;
    lateFrequency[key] = (lateFrequency[key] || 0) + 1;
  });

  const top5LateComers = Object.entries(lateFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Leave by type distribution
  const currentYear = new Date().getFullYear();
  const approvedLeaves = await LeaveRequest.find({
    employee_id: { $in: empIds },
    status: 'approved',
    start_date: { $gte: `${currentYear}-01-01` },
  }).populate('leave_type_id', 'name code');

  const leaveByTypeMap = {};
  approvedLeaves.forEach((l) => {
    const tName = l.leave_type_id?.name || 'Other';
    leaveByTypeMap[tName] = (leaveByTypeMap[tName] || 0) + (l.working_days || 0);
  });
  const leaveByType = Object.entries(leaveByTypeMap).map(([type, days]) => ({
    type,
    days,
  }));

  return {
    date: todayStr,
    headcount,
    presentToday: presentCount,
    lateToday: lateTodayCount,
    halfDayToday,
    onLeaveToday: onLeaveCount,
    pendingApprovals: pendingLeaves,
    attendanceRate,
    latePercent,
    top5LateComers,
    leaveByType,
  };
}
