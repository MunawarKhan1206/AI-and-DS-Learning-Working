import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import LeaveRequest from '@/models/LeaveRequest';
import { formatDate } from '@/lib/business-rules';

export async function GET(req) {
  try {
    const { user, errorResponse } = await requireAuth(req, ['admin', 'hr']);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date') || formatDate(new Date());
    const departmentId = searchParams.get('department') || '';

    const empQuery = { status: { $in: ['active', 'probation'] } };
    if (departmentId) {
      empQuery.department_id = departmentId;
    }

    const employees = await Employee.find(empQuery)
      .populate('department_id', 'name code')
      .populate('designation_id', 'title')
      .sort({ first_name: 1 });

    const empIds = employees.map((e) => e._id);

    // Fetch attendance records for this date
    const attendanceRecords = await Attendance.find({
      employee_id: { $in: empIds },
      date: dateParam,
    });

    const attendanceMap = new Map();
    attendanceRecords.forEach((a) => {
      attendanceMap.set(String(a.employee_id), a);
    });

    // Fetch approved leaves overlapping this date
    const approvedLeaves = await LeaveRequest.find({
      employee_id: { $in: empIds },
      status: 'approved',
      start_date: { $lte: dateParam },
      end_date: { $gte: dateParam },
    }).populate('leave_type_id', 'name code');

    const leaveMap = new Map();
    approvedLeaves.forEach((l) => {
      leaveMap.set(String(l.employee_id), l);
    });

    const board = employees.map((emp) => {
      const empIdStr = String(emp._id);
      const att = attendanceMap.get(empIdStr);
      const leave = leaveMap.get(empIdStr);

      let computedStatus = 'absent';
      if (att) {
        if (!att.check_out) {
          // If past office hours or general end of day, could be missing_checkout or checked in
          computedStatus = att.is_late ? 'late' : 'present';
        } else {
          computedStatus = att.status;
        }
      } else if (leave) {
        computedStatus = 'on_leave';
      }

      return {
        employee: {
          _id: emp._id,
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          department: emp.department_id,
          designation: emp.designation_id,
        },
        date: dateParam,
        status: computedStatus,
        attendance: att || null,
        leave: leave || null,
      };
    });

    // Summary counts
    const counts = {
      total: employees.length,
      present: board.filter((b) => b.status === 'present').length,
      late: board.filter((b) => b.status === 'late').length,
      half_day: board.filter((b) => b.status === 'half_day').length,
      on_leave: board.filter((b) => b.status === 'on_leave').length,
      absent: board.filter((b) => b.status === 'absent').length,
    };

    return NextResponse.json({
      date: dateParam,
      counts,
      board,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
