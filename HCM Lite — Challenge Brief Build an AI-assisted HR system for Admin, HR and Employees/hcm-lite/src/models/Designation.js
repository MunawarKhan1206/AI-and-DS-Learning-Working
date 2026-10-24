import mongoose from 'mongoose';

const DesignationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Designation ||
  mongoose.model('Designation', DesignationSchema);
