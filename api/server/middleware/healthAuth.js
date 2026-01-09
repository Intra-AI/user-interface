const { logger } = require('@librechat/data-schemas');
const crypto = require('crypto');

/**
 * Middleware to authenticate requests to the detailed health endpoint.
 * Uses Bearer token authentication with constant-time comparison to prevent timing attacks.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateHealthCheck = (req, res, next) => {
  const healthCheckToken = process.env.HEALTH_CHECK_TOKEN;

  // If no token is configured, allow access (backward compatibility)
  // However, log a warning about the security risk
  if (!healthCheckToken) {
    logger.warn(
      '[Health Check] HEALTH_CHECK_TOKEN not configured. Detailed health endpoint is publicly accessible. ' +
      'Set HEALTH_CHECK_TOKEN environment variable to secure this endpoint.'
    );
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('[Health Check] Unauthorized access attempt - No authorization header provided', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header required. Use: Authorization: Bearer <token>',
    });
  }

  // Check if it's a Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('[Health Check] Unauthorized access attempt - Invalid authorization format', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization format. Use: Authorization: Bearer <token>',
    });
  }

  const providedToken = parts[1];

  // Use constant-time comparison to prevent timing attacks
  // This ensures attackers cannot guess the token character-by-character
  const expectedBuffer = Buffer.from(healthCheckToken, 'utf-8');
  const providedBuffer = Buffer.from(providedToken, 'utf-8');

  // Both buffers must be the same length
  if (expectedBuffer.length !== providedBuffer.length) {
    logger.warn('[Health Check] Unauthorized access attempt - Invalid token', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }

  // Constant-time comparison
  const isValid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isValid) {
    logger.warn('[Health Check] Unauthorized access attempt - Invalid token', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }

  // Token is valid, proceed
  logger.debug('[Health Check] Authenticated access to detailed health endpoint', {
    ip: req.ip,
  });
  next();
};

/**
 * Rate limiting for health check endpoints to prevent abuse
 * Simple in-memory rate limiter (for production, use Redis-based limiter)
 */
const healthCheckRateLimit = (() => {
  const requests = new Map();
  const WINDOW_MS = 60000; // 1 minute
  const MAX_REQUESTS = 60; // 60 requests per minute per IP

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    // Clean up old entries
    if (requests.size > 1000) {
      const cutoff = now - WINDOW_MS;
      for (const [key, data] of requests.entries()) {
        if (data.resetTime < cutoff) {
          requests.delete(key);
        }
      }
    }

    // Get or create rate limit data for this IP
    let ipData = requests.get(ip);
    if (!ipData || ipData.resetTime < now) {
      ipData = {
        count: 0,
        resetTime: now + WINDOW_MS,
      };
      requests.set(ip, ipData);
    }

    // Check if limit exceeded
    if (ipData.count >= MAX_REQUESTS) {
      logger.warn('[Health Check] Rate limit exceeded', {
        ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((ipData.resetTime - now) / 1000),
      });
    }

    // Increment counter
    ipData.count++;

    next();
  };
})();

module.exports = {
  authenticateHealthCheck,
  healthCheckRateLimit,
};
