import mongoose from 'mongoose';

const AttendanceCorrectionSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    attendance_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    date: {
      type: String,
      required: true,
    },
    proposed_check_in: {
      type: Date,
      required: true,
    },
    proposed_check_out: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    review_comment: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.models.AttendanceCorrection ||
  mongoose.model('AttendanceCorrection', AttendanceCorrectionSchema);
