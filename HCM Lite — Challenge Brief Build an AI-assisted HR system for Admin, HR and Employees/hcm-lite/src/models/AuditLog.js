import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actor_email: {
      type: String,
      default: 'system',
    },
    actor_role: {
      type: String,
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entity: {
      type: String,
      required: true,
      index: true,
    },
    entity_id: {
      type: String,
      default: '',
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: '',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Immutable: no updatedAt
);

// Prevent updating or deleting audit logs at Mongoose middleware level
AuditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});
AuditLogSchema.pre('updateMany', function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});
AuditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});
AuditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

export default mongoose.models.AuditLog ||
  mongoose.model('AuditLog', AuditLogSchema);
