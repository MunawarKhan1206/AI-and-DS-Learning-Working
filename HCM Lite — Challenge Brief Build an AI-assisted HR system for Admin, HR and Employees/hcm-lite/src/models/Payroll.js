import mongoose from 'mongoose';

const PayrollSchema = new mongoose.Schema(
  {
    month: {
      type: String, // YYYY-MM
      required: true,
      index: true,
    },
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    basic_salary: {
      type: Number,
      required: true,
    },
    hra: {
      type: Number,
      required: true,
    },
    medical: {
      type: Number,
      required: true,
    },
    gross_salary: {
      type: Number,
      required: true,
    },
    working_days_in_month: {
      type: Number,
      required: true,
    },
    worked_days: {
      type: Number,
      default: 0,
    },
    absent_days: {
      type: Number,
      default: 0,
    },
    unpaid_leave_days: {
      type: Number,
      default: 0,
    },
    half_days: {
      type: Number,
      default: 0,
    },
    per_day_salary: {
      type: Number,
      required: true,
    },
    absence_deduction: {
      type: Number,
      default: 0,
    },
    tax_deduction: {
      type: Number,
      default: 0,
    },
    net_salary: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'finalized'],
      default: 'draft',
      index: true,
    },
    finalized_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalized_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

PayrollSchema.index({ month: 1, employee_id: 1 }, { unique: true });

export default mongoose.models.Payroll ||
  mongoose.model('Payroll', PayrollSchema);
