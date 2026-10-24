import mongoose from 'mongoose';

const AILogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user_role: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    response: {
      type: String,
      default: '',
    },
    tools_called: {
      type: [String],
      default: [],
    },
    latency_ms: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['success', 'error', 'refused'],
      default: 'success',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.models.AILog || mongoose.model('AILog', AILogSchema);
