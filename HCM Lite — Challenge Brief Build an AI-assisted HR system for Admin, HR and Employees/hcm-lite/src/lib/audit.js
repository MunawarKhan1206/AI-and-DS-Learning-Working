import { connectDB } from './db.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Creates an immutable audit log entry.
 * @param {Object} params
 * @param {Object} params.actor - { _id, email, role }
 * @param {string} params.action - CREATE, UPDATE, APPROVE, REJECT, FINALIZE, DELETE_ATTEMPT
 * @param {string} params.entity - Employee, LeaveRequest, Payroll, Settings, etc.
 * @param {string} [params.entity_id]
 * @param {Object} [params.before]
 * @param {Object} [params.after]
 * @param {string} [params.ip]
 */
export async function createAuditLog({
  actor,
  action,
  entity,
  entity_id = '',
  before = null,
  after = null,
  ip = '',
}) {
  try {
    await connectDB();
    const log = new AuditLog({
      actor_id: actor?._id || null,
      actor_email: actor?.email || 'system',
      actor_role: actor?.role || 'system',
      action,
      entity,
      entity_id: String(entity_id || ''),
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      ip,
    });
    await log.save();
    return log;
  } catch (err) {
    console.error('Failed to create audit log:', err);
    // Audit logging should not crash the main thread if non-critical, but log the error
  }
}
