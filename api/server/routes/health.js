const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { checkEmailConfig, isEnabled } = require('@librechat/api');
const checkIonosHealth = require('../utils/checkIonosHealth');
const { authenticateHealthCheck, healthCheckRateLimit } = require('../middleware/healthAuth');

const router = express.Router();

/**
 * Health check cache to prevent excessive external API calls
 * TTL: 30 seconds for IONOS and RAG API checks
 */
const healthCache = {
  ionos: { data: null, timestamp: 0, ttl: 30000 },
  rag: { data: null, timestamp: 0, ttl: 30000 },
};

/**
 * Checks if cached data is still valid
 * @param {string} key - Cache key
 * @returns {boolean}
 */
const isCacheValid = (key) => {
  const cache = healthCache[key];
  return cache.data !== null && (Date.now() - cache.timestamp) < cache.ttl;
};

/**
 * Gets cached data or executes the check function
 * @param {string} key - Cache key
 * @param {Function} checkFn - Async function to execute if cache is invalid
 * @returns {Promise<any>}
 */
const getCachedOrFetch = async (key, checkFn) => {
  if (isCacheValid(key)) {
    return healthCache[key].data;
  }

  const result = await checkFn();
  healthCache[key] = {
    data: result,
    timestamp: Date.now(),
    ttl: 30000,
  };
  return result;
};

/**
 * Checks MongoDB connection health
 * @returns {Object}
 */
const checkMongoDBHealth = () => {
  const readyState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: readyState === 1 ? 'up' : 'down',
    readyState,
    state: states[readyState] || 'unknown',
  };
};

/**
 * Checks Meilisearch health
 * @returns {Promise<Object>}
 */
const checkMeilisearchHealth = async () => {
  try {
    const meiliEnabled = isEnabled(process.env.MEILI_NO_ANALYTICS === undefined);
    if (!meiliEnabled || !process.env.MEILI_HOST) {
      return { status: 'disabled', message: 'Meilisearch not configured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${process.env.MEILI_HOST}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { status: data.status === 'available' ? 'up' : 'down', ...data };
    }

    return { status: 'down', error: `HTTP ${response.status}` };
  } catch (error) {
    return {
      status: 'down',
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  }
};

/**
 * Checks RAG API health
 * @returns {Promise<Object>}
 */
const checkRAGHealth = async () => {
  try {
    const ragUrl = process.env.RAG_API_URL;
    if (!ragUrl) {
      return { status: 'disabled', message: 'RAG API not configured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${ragUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      status: response.ok ? 'up' : 'down',
      url: ragUrl,
      httpCode: response.status,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  }
};

/**
 * Checks VectorDB (PostgreSQL with pgvector) health
 * @returns {Promise<Object>}
 */
const checkVectorDBHealth = async () => {
  try {
    const vectorDbUrl = process.env.RAG_API_URL;
    if (!vectorDbUrl) {
      return { status: 'disabled', message: 'VectorDB not configured' };
    }

    // VectorDB is checked via RAG API, as it's tightly coupled
    return { status: 'dependent_on_rag', message: 'Checked via RAG API' };
  } catch (error) {
    return { status: 'unknown', error: error.message };
  }
};

/**
 * Checks email service configuration
 * @returns {Object}
 */
const checkEmailServiceHealth = () => {
  const isConfigured = checkEmailConfig();
  const passwordResetEnabled = isEnabled(process.env.ALLOW_PASSWORD_RESET);
  const emailLoginEnabled = isEnabled(process.env.ALLOW_EMAIL_LOGIN);

  return {
    status: isConfigured ? 'configured' : 'not_configured',
    passwordResetEnabled,
    emailLoginEnabled,
    provider: process.env.EMAIL_SERVICE || process.env.MAILGUN_API_KEY ? 'mailgun' : 'smtp',
  };
};

/**
 * Checks authentication providers configuration
 * @returns {Object}
 */
const checkAuthHealth = () => {
  return {
    local: isEnabled(process.env.ALLOW_EMAIL_LOGIN),
    ldap: !!(process.env.LDAP_URL && process.env.LDAP_USER_SEARCH_BASE),
    openid: !!process.env.OPENID_ISSUER,
    social: isEnabled(process.env.ALLOW_SOCIAL_LOGIN),
    registration: isEnabled(process.env.ALLOW_REGISTRATION),
  };
};

/**
 * Checks Redis connection health (if enabled)
 * @returns {Object}
 */
const checkRedisHealth = () => {
  const useRedis = isEnabled(process.env.USE_REDIS);
  
  if (!useRedis) {
    return { status: 'disabled', message: 'Redis not enabled' };
  }

  // Note: We could implement actual Redis ping here if needed
  // For now, we just check if it's configured
  return {
    status: process.env.REDIS_URI ? 'configured' : 'not_configured',
    message: 'Redis configuration present',
  };
};

/**
 * Public health check endpoint - Minimal information for SLA monitoring
 * Returns HTTP 200 only if ALL critical services are healthy
 * Returns HTTP 503 if any critical service is down
 * 
 * This endpoint is intentionally minimal to avoid leaking system information.
 * For detailed diagnostics, use /health/detailed with authentication.
 * 
 * Response format:
 * - 200: { "status": "healthy", "timestamp": "..." }
 * - 503: { "status": "unhealthy", "timestamp": "..." }
 */
router.get('/', healthCheckRateLimit, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Run minimal critical checks only
    const mongodb = checkMongoDBHealth();
    const ionos = await getCachedOrFetch('ionos', checkIonosHealth);
    const auth = checkAuthHealth();

    // Determine overall system health (critical services only)
    const isMongoDB = mongodb.status === 'up';
    const isIonos = ionos.healthy;
    const isAuth = auth.local || auth.ldap || auth.openid || auth.social;

    const allCriticalHealthy = isMongoDB && isIonos && isAuth;

    const responseTime = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    if (allCriticalHealthy) {
      // All critical services healthy - return simple success
      res.status(200).json({
        status: 'healthy',
        timestamp,
        responseTime: `${responseTime}ms`,
      });
    } else {
      // One or more critical services down
      logger.error('[Health Check] Critical services down', {
        mongodb: isMongoDB,
        ionos: isIonos,
        auth: isAuth,
      });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp,
        responseTime: `${responseTime}ms`,
      });
    }
  } catch (error) {
    logger.error('[Health Check] Unexpected error during health check', error);
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
    });
  }
});

/**
 * Comprehensive health check endpoint - Detailed diagnostics (AUTHENTICATED)
 * Requires Bearer token authentication via HEALTH_CHECK_TOKEN env variable
 * Returns detailed information about all services for troubleshooting
 * 
 * Usage: 
 * curl -H "Authorization: Bearer <token>" https://chat.intra-ai.de/health/detailed
 */
router.get('/detailed', healthCheckRateLimit, authenticateHealthCheck, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel for efficiency
    const [
      mongodb,
      meilisearch,
      rag,
      vectordb,
      ionos,
      email,
      auth,
      redis,
    ] = await Promise.all([
      Promise.resolve(checkMongoDBHealth()),
      checkMeilisearchHealth(),
      getCachedOrFetch('rag', checkRAGHealth),
      checkVectorDBHealth(),
      getCachedOrFetch('ionos', checkIonosHealth),
      Promise.resolve(checkEmailServiceHealth()),
      Promise.resolve(checkAuthHealth()),
      Promise.resolve(checkRedisHealth()),
    ]);

    // Determine overall system health
    const criticalServices = {
      mongodb: mongodb.status === 'up',
      ionos: ionos.healthy,
      auth: auth.local || auth.ldap || auth.openid || auth.social,
    };

    const importantServices = {
      rag: rag.status === 'up' || rag.status === 'disabled',
      email: email.status === 'configured' || !email.passwordResetEnabled,
      meilisearch: meilisearch.status === 'up' || meilisearch.status === 'disabled',
    };

    // Check if all critical services are healthy
    const allCriticalHealthy = Object.values(criticalServices).every(v => v === true);
    const allImportantHealthy = Object.values(importantServices).every(v => v === true);

    // Determine overall status
    let overallStatus = 'healthy';
    let httpStatus = 200;

    if (!allCriticalHealthy) {
      overallStatus = 'unhealthy';
      httpStatus = 503;
      logger.error('[Health Check] Critical services are down', { criticalServices });
    } else if (!allImportantHealthy) {
      overallStatus = 'degraded';
      httpStatus = 200; // Still return 200 for degraded but functional
      logger.warn('[Health Check] Some important services are degraded', { importantServices });
    }

    const responseTime = Date.now() - startTime;

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        critical: {
          mongodb,
          ionos_api: {
            status: ionos.healthy ? 'up' : 'down',
            models: ionos.models || [],
            expectedModelsAvailable: ionos.expectedModelsAvailable,
            error: ionos.error,
          },
          authentication: {
            status: criticalServices.auth ? 'configured' : 'not_configured',
            providers: auth,
          },
        },
        important: {
          rag_api: rag,
          email_service: email,
          meilisearch,
        },
        optional: {
          vectordb,
          redis,
        },
      },
      checks: {
        canAuthenticate: criticalServices.auth,
        canUseAI: ionos.healthy && ionos.expectedModelsAvailable,
        canResetPassword: email.status === 'configured' && email.passwordResetEnabled,
        canSearch: meilisearch.status === 'up',
        canUploadFiles: rag.status === 'up',
      },
    };

    // Log health check for monitoring
    if (httpStatus !== 200) {
      logger.error('[Health Check] System unhealthy', {
        status: overallStatus,
        criticalServices,
        importantServices,
      });
    }

    res.status(httpStatus).json(healthResponse);
  } catch (error) {
    logger.error('[Health Check] Unexpected error during health check', error);
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed unexpectedly',
      message: error.message,
    });
  }
});

module.exports = router;
