const { logger } = require('@librechat/data-schemas');

/**
 * Checks the health of the IONOS API by calling the /v1/models endpoint.
 * This is a lightweight check that doesn't consume tokens or generate content.
 *
 * @async
 * @function checkIonosHealth
 * @returns {Promise<Object>} - An object with status, available models, and any error information.
 * @property {boolean} healthy - Whether the IONOS API is accessible and responding.
 * @property {Array<string>} models - List of available model IDs (if successful).
 * @property {string} error - Error message (if failed).
 */
const checkIonosHealth = async () => {
  const ionosApiKey = process.env.IONOS_API_KEY;
  const ionosBaseUrl = 'https://openai.inference.de-txl.ionos.com';

  if (!ionosApiKey) {
    return {
      healthy: false,
      models: [],
      error: 'IONOS_API_KEY not configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${ionosBaseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ionosApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`IONOS API health check failed with status: ${response.status}`);
      return {
        healthy: false,
        models: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const modelIds = data.data ? data.data.map((model) => model.id) : [];

    // Check if the expected models are available
    const expectedModels = ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'];
    const hasExpectedModels = expectedModels.every((model) => modelIds.includes(model));

    if (!hasExpectedModels) {
      logger.warn('IONOS API: Expected models not found in available models list');
    }

    return {
      healthy: true,
      models: modelIds,
      expectedModelsAvailable: hasExpectedModels,
    };
  } catch (error) {
    const errorMessage = error.name === 'AbortError' 
      ? 'Request timeout (5s)' 
      : error.message;

    logger.error('[checkIonosHealth]', error);
    return {
      healthy: false,
      models: [],
      error: errorMessage,
    };
  }
};

module.exports = checkIonosHealth;
