import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema(
  {
    employee_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    designation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
      required: true,
    },
    joining_date: {
      type: Date,
      required: true,
    },
    exit_date: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'probation', 'resigned', 'terminated'],
      default: 'active',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male',
    },
    basic_salary: {
      type: Number,
      required: true,
      default: 0,
    },
    hra: {
      type: Number,
      default: 0, // 40% of basic
    },
    medical: {
      type: Number,
      default: 0, // 10% of basic
    },
    gross_salary: {
      type: Number,
      default: 0, // 1.5 * basic
    },
    bank_account: {
      type: String,
      default: '',
    },
    tax_id: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Auto compute hra, medical, gross_salary before save
EmployeeSchema.pre('save', function () {
  if (this.isModified('basic_salary') || !this.gross_salary) {
    this.hra = Math.round(this.basic_salary * 0.4);
    this.medical = Math.round(this.basic_salary * 0.1);
    this.gross_salary = this.basic_salary + this.hra + this.medical; // exactly 1.5 * basic
  }
});

export default mongoose.models.Employee ||
  mongoose.model('Employee', EmployeeSchema);
