import type * as t from '~/types';
import auditLogSchema from '~/schema/auditLog';

/**
 * Creates or returns the AuditLog model using the provided mongoose instance and schema
 */
export function createAuditLogModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.AuditLog || mongoose.model<t.IAuditLog>('AuditLog', auditLogSchema, 'auditlogs');
}
