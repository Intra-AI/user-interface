const express = require('express');
const axios = require('axios');
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('~/config');

const router = express.Router();

/**
 * POST /api/support
 * Submit a support request to Zammad
 * @body {string} subject - The subject of the support request
 * @body {string} category - The category (bug, feature, question, technical)
 * @body {string} priority - The priority level (low, normal, high)
 * @body {string} description - Detailed description of the issue
 */
router.post('/', requireJwtAuth, async (req, res) => {
  try {
    const { subject, category, priority, description } = req.body;
    const user = req.user;

    logger.info('[/api/support] Received support request:', {
      userId: user?.id,
      userEmail: user?.email,
      subject: subject,
      category: category,
      priority: priority,
      hasDescription: !!description,
    });

    // Validate required fields
    if (!subject || !category || !priority || !description) {
      logger.warn('[/api/support] Missing required fields:', {
        subject: !!subject,
        category: !!category,
        priority: !!priority,
        description: !!description,
      });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, category, priority, and description are required',
      });
    }

    // Get Zammad configuration from environment variables
    const zammadUrl = process.env.ZAMMAD_URL;
    const zammadToken = process.env.ZAMMAD_API_TOKEN;
    const zammadGroup = process.env.ZAMMAD_GROUP || 'Users';

    logger.info('[/api/support] Zammad configuration:', {
      zammadUrl: zammadUrl || 'NOT SET',
      hasToken: !!zammadToken,
      zammadGroup: zammadGroup,
    });

    if (!zammadUrl || !zammadToken) {
      logger.error('[/api/support] Zammad is not configured. Missing ZAMMAD_URL or ZAMMAD_API_TOKEN');
      return res.status(500).json({
        success: false,
        message: 'Support system is not configured',
      });
    }

    // Map priority to Zammad priority names
    const priorityMap = {
      low: '1 low',
      normal: '2 normal',
      high: '3 high',
    };

    // Build the article body with structured information
    const articleBody = `
**Category:** ${category}

**Description:**
${description}

---
**User Information:**
- Name: ${user.name || 'N/A'}
- Email: ${user.email}
- User ID: ${user.id}
    `.trim();

    // Prepare Zammad ticket payload
    // Use guess: prefix to auto-create customer if they don't exist
    const zammadPayload = {
      title: `[${category.toUpperCase()}] ${subject}`,
      group: zammadGroup,
      customer_id: `guess:${user.email}`,
      priority: priorityMap[priority] || '2 normal',
      article: {
        subject: subject,
        body: articleBody,
        type: 'note',
        internal: false,
      },
    };

    logger.info('[/api/support] Submitting ticket to Zammad:', {
      userId: user.id,
      subject: subject,
      category: category,
      url: `${zammadUrl}/api/v1/tickets`,
      payload: JSON.stringify(zammadPayload),
    });

    // Send request to Zammad API
    const zammadResponse = await axios.post(
      `${zammadUrl}/api/v1/tickets`,
      zammadPayload,
      {
        headers: {
          'Authorization': `Token token=${zammadToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      },
    );

    logger.info('[/api/support] Ticket created successfully:', {
      ticketId: zammadResponse.data.id,
      ticketNumber: zammadResponse.data.number,
    });

    res.status(200).json({
      success: true,
      ticketId: zammadResponse.data.id,
      ticketNumber: zammadResponse.data.number,
      message: 'Support request submitted successfully',
    });
  } catch (error) {
    logger.error('[/api/support] Error submitting support request:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });

    // Handle Zammad-specific errors
    if (error.response) {
      logger.error('[/api/support] Zammad API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      });

      // For 422 errors, provide more specific error message
      if (error.response.status === 422) {
        logger.error('[/api/support] Validation error details:', {
          errorData: JSON.stringify(error.response.data, null, 2),
        });
      }

      return res.status(error.response.status).json({
        success: false,
        message: 'Failed to submit support request to Zammad',
        error: error.response.data,
      });
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.error('[/api/support] Network error connecting to Zammad:', {
        code: error.code,
        message: error.message,
      });
      return res.status(503).json({
        success: false,
        message: 'Cannot connect to support system',
      });
    }

    // Generic error
    logger.error('[/api/support] Generic error:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Error submitting support request',
      error: error.message,
    });
  }
});

module.exports = router;
