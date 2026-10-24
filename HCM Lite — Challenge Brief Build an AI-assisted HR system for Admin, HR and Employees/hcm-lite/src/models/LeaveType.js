import mongoose from 'mongoose';

const LeaveTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    quota: {
      type: Number,
      required: true,
      default: 0,
    },
    is_paid: {
      type: Boolean,
      default: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.LeaveType ||
  mongoose.model('LeaveType', LeaveTypeSchema);
