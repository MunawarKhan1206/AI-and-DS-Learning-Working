import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    target_role: {
      type: String,
      enum: ['all', 'employee', 'hr'],
      default: 'all',
    },
  },
  { timestamps: true }
);

export default mongoose.models.Announcement ||
  mongoose.model('Announcement', AnnouncementSchema);
