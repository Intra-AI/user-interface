// Default storage limit: 5GB in bytes (use 104857 for 0.1MB testing)
const DEFAULT_STORAGE_LIMIT = 104857; // 0.1MB for testing - change to 5368709120 for 5GB

/**
 * Get the storage limit from config or use default
 * @param {Object} req - Express request object
 * @returns {number} Storage limit in bytes
 */
const getStorageLimit = (req) => {
  const configLimit = req.app.locals.config?.storage?.userStorageLimit;
  return configLimit || DEFAULT_STORAGE_LIMIT;
};

module.exports = {
  DEFAULT_STORAGE_LIMIT,
  getStorageLimit,
};
