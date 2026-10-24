import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    check_in: {
      type: Date,
      required: true,
    },
    check_out: {
      type: Date,
      default: null,
    },
    worked_hours: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['present', 'late', 'half_day', 'absent', 'missing_checkout'],
      default: 'present',
    },
    is_late: {
      type: Boolean,
      default: false,
    },
    late_minutes: {
      type: Number,
      default: 0,
    },
    check_in_lat: {
      type: Number,
      default: null,
    },
    check_in_lng: {
      type: Number,
      default: null,
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Guarantee only one attendance record per employee per day
AttendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });

export default mongoose.models.Attendance ||
  mongoose.model('Attendance', AttendanceSchema);
