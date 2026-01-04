import mongoose, { Schema } from 'mongoose';
import type { IAuditLog } from '~/types';

/**
 * DSGVO-konforme Audit Log Schema
 * Speichert kritische Benutzeraktionen für Compliance-Zwecke
 * 
 * Retention: 3 Jahre (gesetzliche Aufbewahrungspflicht)
 */
const auditLogSchema: Schema<IAuditLog> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'USER_LOGIN',           // Erfolgreicher Login
        'USER_LOGOUT',          // Logout
        'USER_REGISTERED',      // Neue Registrierung
        'USER_DELETED',         // Account gelöscht (Art. 17 DSGVO)
        'PERSONAL_DATA_CHANGED', // Email/Name/Passwort geändert
        'TERMS_ACCEPTED',       // Terms & Conditions akzeptiert (Art. 7 DSGVO)
        'INITIAL_PASSWORD_RESET', // Initial password reset completed
        'INITIAL_2FA_SETUP',      // Initial 2FA setup completed
      ],
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    email: {
      type: String,
      index: true,
    },
  },
  { 
    timestamps: true,
    // Nicht automatisch löschen - manuelle Retention Policy nach 3 Jahren
  },
);

// Compound Index für effiziente Queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }); // Für Retention Policy Cleanup

export default auditLogSchema;
