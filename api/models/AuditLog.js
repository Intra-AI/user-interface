const { logger } = require('@librechat/data-schemas');
const mongoose = require('mongoose');

/**
 * Lazy-load AuditLog Model to avoid circular dependencies
 */
let _auditLogModel = null;
const getAuditLogModel = () => {
  if (_auditLogModel) {
    return _auditLogModel;
  }
  
  try {
    // Versuche zuerst das Model direkt von mongoose zu holen
    if (mongoose.models.AuditLog) {
      _auditLogModel = mongoose.models.AuditLog;
      return _auditLogModel;
    }
    
    // Fallback: Versuche über ~/db/models zu laden
    const models = require('~/db/models');
    if (models && models.AuditLog) {
      _auditLogModel = models.AuditLog;
      return _auditLogModel;
    }
    
    logger.warn('[AuditLog] Model not available yet');
    return null;
  } catch (error) {
    logger.error('[AuditLog] Error loading AuditLog model:', error);
    return null;
  }
};

/**
 * DSGVO Audit Logging Service
 * 
 * Dieser Service loggt alle kritischen Benutzeraktionen für DSGVO-Compliance.
 * Die Logs werden für 3 Jahre aufbewahrt (gesetzliche Anforderung).
 * 
 * Verwendung:
 * - Nachweis der Einwilligung (Art. 7 DSGVO)
 * - Nachweis der Datenlöschung (Art. 17 DSGVO)
 * - Sicherheit und Zugriffskontrolle (Art. 32 DSGVO)
 * - Bei Datenschutzverletzungen (Art. 33 DSGVO)
 */

/**
 * Extrahiert IP-Adresse aus Request
 * @param {Object} req - Express Request Objekt
 * @returns {string|undefined} IP-Adresse
 */
const getIpAddress = (req) => {
  if (!req || !req.headers) return undefined;
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip
  );
};

/**
 * Extrahiert User Agent aus Request
 * @param {Object} req - Express Request Objekt
 * @returns {string|undefined} User Agent String
 */
const getUserAgent = (req) => {
  if (!req || !req.headers) return undefined;
  return req.headers['user-agent'];
};

/**
 * Erstellt einen Audit Log Eintrag
 * 
 * @param {Object} params - Audit Log Parameter
 * @param {string|ObjectId} params.userId - User ID
 * @param {string} params.action - Action Type (z.B. 'USER_LOGIN')
 * @param {Object} [params.details={}] - Zusätzliche Details
 * @param {Object} [params.req] - Express Request (für IP & User Agent)
 * @param {string} [params.email] - User Email (optional, für gelöschte User)
 * @returns {Promise<Object>} Gespeicherter Audit Log
 */
const createAuditLog = async ({ userId, action, details = {}, req, email }) => {
  try {
    const AuditLog = getAuditLogModel();
    if (!AuditLog) {
      logger.warn('[AuditLog] Model not available, skipping audit log creation');
      return null;
    }
    
    const auditLog = await AuditLog.create({
      userId,
      action,
      details,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      email,
    });

    logger.info(`[AuditLog] ${action} | User: ${userId} | IP: ${auditLog.ipAddress}`);
    return auditLog;
  } catch (error) {
    // Audit Log Fehler sollten die Hauptfunktion nicht blockieren
    logger.error('[AuditLog] Error creating audit log:', error);
    return null;
  }
};

/**
 * Holt Audit Logs für einen User => Notwendig für Audit Dashboard
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {Object} [options={}] - Query Optionen
 * @param {number} [options.limit=100] - Maximale Anzahl
 * @param {Date} [options.startDate] - Start Datum
 * @param {Date} [options.endDate] - End Datum
 * @returns {Promise<Array>} Array von Audit Logs
 */
const getUserAuditLogs = async (userId, options = {}) => {
  try {
    const AuditLog = getAuditLogModel();
    if (!AuditLog) {
      logger.warn('[AuditLog] Model not available, returning empty logs');
      return [];
    }

    const { limit = 100, startDate, endDate } = options;
    
    const query = { userId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return logs;
  } catch (error) {
    logger.error('[AuditLog] Error fetching user audit logs:', error);
    return [];
  }
};

/**
 * Löscht alte Audit Logs (Retention Policy: 3 Jahre)
 * Diese Funktion sollte regelmäßig per Cron Job ausgeführt werden.
 * 
 * @param {number} [retentionYears=3] - Aufbewahrungsfrist in Jahren
 * @returns {Promise<Object>} Anzahl gelöschter Logs
 */
const cleanupOldAuditLogs = async (retentionYears = 3) => {
  try {
    const AuditLog = getAuditLogModel();
    if (!AuditLog) {
      logger.warn('[AuditLog] Model not available, skipping cleanup');
      return { deletedCount: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

    const result = await AuditLog.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    logger.info(
      `[AuditLog] Cleanup: Deleted ${result.deletedCount} audit logs older than ${retentionYears} years`,
    );
    return result;
  } catch (error) {
    logger.error('[AuditLog] Error cleaning up old audit logs:', error);
    throw error;
  }
};

module.exports = {
  createAuditLog,
  getUserAuditLogs,
  cleanupOldAuditLogs,
  getIpAddress,
  getUserAgent,
};
