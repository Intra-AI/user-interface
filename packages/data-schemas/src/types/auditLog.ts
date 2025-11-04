import type { Document, Types } from 'mongoose';

/**
 * Audit Log Actions für DSGVO Compliance
 */
export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_DELETED = 'USER_DELETED',
  PERSONAL_DATA_CHANGED = 'PERSONAL_DATA_CHANGED',
  TERMS_ACCEPTED = 'TERMS_ACCEPTED',
}

/**
 * Audit Log Interface für MongoDB Document
 */
export interface IAuditLog extends Document {
  userId: Types.ObjectId;
  action: AuditAction;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  email?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Audit Log Creation Parameters
 */
export interface CreateAuditLogParams {
  userId: string | Types.ObjectId;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  email?: string;
}
