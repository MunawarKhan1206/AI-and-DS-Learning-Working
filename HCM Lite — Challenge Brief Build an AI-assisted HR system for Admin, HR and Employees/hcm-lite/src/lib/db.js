import mongoose from 'mongoose';

// Register all models so populate() works across all API routes
import '../models/User.js';
import '../models/Employee.js';
import '../models/CompanySettings.js';
import '../models/Department.js';
import '../models/Designation.js';
import '../models/Attendance.js';
import '../models/AttendanceCorrection.js';
import '../models/LeaveType.js';
import '../models/LeaveRequest.js';
import '../models/Holiday.js';
import '../models/Payroll.js';
import '../models/Announcement.js';
import '../models/Notification.js';
import '../models/AuditLog.js';
import '../models/AILog.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hcm-lite';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
