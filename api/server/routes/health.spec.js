const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const healthRoute = require('./health');
const checkIonosHealth = require('../utils/checkIonosHealth');

// Mock dependencies
jest.mock('../utils/checkIonosHealth');
jest.mock('@librechat/api', () => ({
  checkEmailConfig: jest.fn(),
  isEnabled: jest.fn(),
}));

const { checkEmailConfig, isEnabled } = require('@librechat/api');

describe('Health Check Endpoint', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/health', healthRoute);
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 when all critical services are healthy', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock authentication as configured
      isEnabled.mockImplementation((value) => {
        if (value === undefined) return false; // For MEILI_NO_ANALYTICS check
        return !!value;
      });
      process.env.ALLOW_EMAIL_LOGIN = 'true';

      // Mock email service
      checkEmailConfig.mockReturnValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services.critical.mongodb.status).toBe('up');
      expect(response.body.services.critical.ionos_api.status).toBe('up');
      expect(response.body.checks.canAuthenticate).toBe(true);
      expect(response.body.checks.canUseAI).toBe(true);
    });

    it('should return 503 when MongoDB is down', async () => {
      // Mock MongoDB connection as disconnected
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock authentication as configured
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      isEnabled.mockReturnValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.critical.mongodb.status).toBe('down');
    });

    it('should return 503 when IONOS API is down', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as unhealthy
      checkIonosHealth.mockResolvedValue({
        healthy: false,
        models: [],
        error: 'Connection timeout',
      });

      // Mock authentication as configured
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      isEnabled.mockReturnValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.critical.ionos_api.status).toBe('down');
      expect(response.body.checks.canUseAI).toBe(false);
    });

    it('should return 503 when no authentication provider is configured', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock no authentication configured
      delete process.env.ALLOW_EMAIL_LOGIN;
      delete process.env.LDAP_URL;
      delete process.env.OPENID_ISSUER;
      delete process.env.ALLOW_SOCIAL_LOGIN;
      isEnabled.mockReturnValue(false);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.canAuthenticate).toBe(false);
    });

    it('should return 200 (degraded) when RAG API is down but critical services are up', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock authentication as configured
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      isEnabled.mockReturnValue(true);

      // Mock RAG API as unavailable
      process.env.RAG_API_URL = 'http://localhost:8000';
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.important.rag_api.status).toBe('down');
    });

    it('should include authentication provider information', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock multiple auth providers
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      process.env.LDAP_URL = 'ldap://localhost';
      process.env.LDAP_USER_SEARCH_BASE = 'dc=example,dc=com';
      process.env.OPENID_ISSUER = 'https://login.microsoftonline.com/tenant-id/v2.0';
      isEnabled.mockReturnValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.services.critical.authentication.providers.local).toBe(true);
      expect(response.body.services.critical.authentication.providers.ldap).toBe(true);
      expect(response.body.services.critical.authentication.providers.openid).toBe(true);
    });

    it('should include email service configuration status', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock authentication
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      isEnabled.mockReturnValue(true);

      // Mock email service as configured
      checkEmailConfig.mockReturnValue(true);
      process.env.ALLOW_PASSWORD_RESET = 'true';

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.services.important.email_service.status).toBe('configured');
      expect(response.body.services.important.email_service.passwordResetEnabled).toBe(true);
      expect(response.body.checks.canResetPassword).toBe(true);
    });

    it('should check IONOS expected models availability', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API with unexpected models
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['some-other-model'],
        expectedModelsAvailable: false,
      });

      // Mock authentication
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      isEnabled.mockReturnValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.services.critical.ionos_api.expectedModelsAvailable).toBe(false);
      expect(response.body.checks.canUseAI).toBe(false);
    });

    it('should include response time in the response', async () => {
      // Mock MongoDB connection as healthy
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      // Mock IONOS API as healthy
      checkIonosHealth.mockResolvedValue({
        healthy: true,
        models: ['mistralai/Mistral-Small-24B-Instruct', 'openai/gpt-oss-120b'],
        expectedModelsAvailable: true,
      });

      // Mock authentication
      process.env.ALLOW_EMAIL_LOGIN = 'true';
      isEnabled.mockReturnValue(true);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('responseTime');
      expect(response.body.responseTime).toMatch(/\d+ms/);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock MongoDB to throw an error
      jest.spyOn(mongoose.connection, 'readyState', 'get').mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('error');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });
});
