const express = require('express');
const { getFiles } = require('~/models/File');
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('~/config');
const { getStorageLimit } = require('~/server/utils/storage');

const router = express.Router();

/**
 * GET /api/storage
 * Returns the user's storage usage statistics
 */
router.get('/', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = getStorageLimit(req);

    // Get all files for the user
    const files = await getFiles({ user: userId });

    // Calculate total bytes used
    const used = files.reduce((sum, file) => sum + (file.bytes || 0), 0);

    // Calculate percentage (cap at 100)
    const percentage = Math.min(Math.round((used / limit) * 100), 100);

    res.status(200).json({
      used,
      limit,
      percentage,
      fileCount: files.length,
    });
  } catch (error) {
    logger.error('[/api/storage] Error getting storage usage:', error);
    res.status(500).json({ message: 'Error getting storage usage', error: error.message });
  }
});

module.exports = router;
