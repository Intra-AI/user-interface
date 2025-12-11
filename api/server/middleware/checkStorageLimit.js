const { getFiles } = require('~/models/File');
const { logger } = require('~/config');
const { getStorageLimit } = require('~/server/utils/storage');

/**
 * Middleware to check if user has exceeded their storage limit
 * Returns 413 (Payload Too Large) if limit is exceeded
 */
const checkStorageLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    const limit = getStorageLimit(req);

    // Get all files for the user
    const files = await getFiles({ user: userId });

    // Calculate total bytes used
    const used = files.reduce((sum, file) => sum + (file.bytes || 0), 0);

    // Check if already at or over limit
    if (used >= limit) {
      logger.warn(`[checkStorageLimit] User ${userId} has exceeded storage limit: ${used}/${limit} bytes`);
      return res.status(413).json({
        code: 'STORAGE_LIMIT_EXCEEDED',
        message: 'Storage limit exceeded',
        used,
        limit,
        percentage: 100,
      });
    }

    // Attach storage info to request for potential use downstream
    req.userStorageUsed = used;
    req.userStorageLimit = limit;

    next();
  } catch (error) {
    logger.error('[checkStorageLimit] Error checking storage limit:', error);
    // Don't block upload on error, just continue
    next();
  }
};

module.exports = checkStorageLimit;
