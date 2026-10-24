import mongoose from 'mongoose';

const LeaveRequestSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    leave_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    start_date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    end_date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    working_days: {
      type: Number,
      required: true,
      default: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
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
    cancelled_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

LeaveRequestSchema.index({ employee_id: 1, status: 1 });

export default mongoose.models.LeaveRequest ||
  mongoose.model('LeaveRequest', LeaveRequestSchema);
