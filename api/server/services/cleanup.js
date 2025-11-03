const { logger } = require('~/config');
const { deleteNullOrEmptyConversations, deleteOldConversations } = require('~/models/Conversation');

const cleanup = async () => {
  try {
    await deleteNullOrEmptyConversations();
  } catch (error) {
    logger.error('[cleanup] Error during app cleanup', error);
  } finally {
    logger.debug('Startup cleanup complete');
  }
};

let cleanupInterval = null;

/**
 * Starts a scheduled task that deletes old conversations every specified interval.
 * @param {number} intervalMinutes - How often to run the cleanup (in minutes)
 * @param {number} ageMinutes - Delete conversations older than this (in minutes)
 */
const startScheduledCleanup = (intervalMinutes = 5, ageMinutes = 5) => {
  if (cleanupInterval) {
    logger.warn('[startScheduledCleanup] Cleanup interval already running');
    return;
  }

  logger.info(`[startScheduledCleanup] Starting scheduled cleanup: running every ${intervalMinutes} minutes, deleting chats older than ${ageMinutes} minutes`);

  // Run immediately on startup
  deleteOldConversations(ageMinutes).catch(error => {
    logger.error('[startScheduledCleanup] Error during initial cleanup', error);
  });

  // Then run on schedule
  cleanupInterval = setInterval(async () => {
    try {
      await deleteOldConversations(ageMinutes);
    } catch (error) {
      logger.error('[startScheduledCleanup] Error during scheduled cleanup', error);
    }
  }, intervalMinutes * 60 * 1000);

  logger.debug(`[startScheduledCleanup] Scheduled cleanup initialized`);
};

/**
 * Stops the scheduled cleanup task
 */
const stopScheduledCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[stopScheduledCleanup] Scheduled cleanup stopped');
  }
};

module.exports = { cleanup, startScheduledCleanup, stopScheduledCleanup };
