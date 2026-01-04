const { logger } = require('@librechat/data-schemas');
const { webSearchKeys, extractWebSearchEnvVars, normalizeHttpError } = require('@librechat/api');
const { createAuditLog } = require('~/models/AuditLog');
const { isEnabled } = require('~/server/utils');
const {
  getFiles,
  updateUser,
  deleteFiles,
  deleteConvos,
  deletePresets,
  deleteMessages,
  deleteUserById,
  deleteAllUserSessions,
  comparePassword,
} = require('~/models');
const { updateUserPluginAuth, deleteUserPluginAuth } = require('~/server/services/PluginService');
const { updateUserPluginsService, deleteUserKey } = require('~/server/services/UserService');
const { verifyEmail, resendVerificationEmail } = require('~/server/services/AuthService');
const { needsRefresh, getNewS3URL } = require('~/server/services/Files/S3/crud');
const { Tools, Constants, FileSources } = require('librechat-data-provider');
const { processDeleteRequest } = require('~/server/services/Files/process');
const { Transaction, Balance, User } = require('~/db/models');
const { getAppConfig } = require('~/server/services/Config');
const { deleteToolCalls } = require('~/models/ToolCall');
const { deleteAllSharedLinks } = require('~/models');
const { getMCPManager } = require('~/config');

const getUserController = async (req, res) => {
  const appConfig = await getAppConfig({ role: req.user?.role });
  /** @type {IUser} */
  const userData = req.user.toObject != null ? req.user.toObject() : { ...req.user };
  /**
   * These fields should not exist due to secure field selection, but deletion
   * is done in case of alternate database incompatibility with Mongo API
   * */
  delete userData.password;
  delete userData.totpSecret;
  delete userData.backupCodes;
  if (appConfig.fileStrategy === FileSources.s3 && userData.avatar) {
    const avatarNeedsRefresh = needsRefresh(userData.avatar, 3600);
    if (!avatarNeedsRefresh) {
      return res.status(200).send(userData);
    }
    const originalAvatar = userData.avatar;
    try {
      userData.avatar = await getNewS3URL(userData.avatar);
      await updateUser(userData.id, { avatar: userData.avatar });
    } catch (error) {
      userData.avatar = originalAvatar;
      logger.error('Error getting new S3 URL for avatar:', error);
    }
  }
  res.status(200).send(userData);
};

const getTermsStatusController = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ termsAccepted: !!user.termsAccepted });
  } catch (error) {
    logger.error('Error fetching terms acceptance status:', error);
    res.status(500).json({ message: 'Error fetching terms acceptance status' });
  }
};

const acceptTermsController = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { termsAccepted: true }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // DSGVO Audit Log: Terms Acceptance (Art. 7 DSGVO - Nachweis der Einwilligung)
    await createAuditLog({
      userId: user._id,
      action: 'TERMS_ACCEPTED',
      details: {
        email: user.email,
        acceptedAt: new Date().toISOString(),
      },
      req,
      email: user.email,
    });
    
    res.status(200).json({ message: 'Terms accepted successfully' });
  } catch (error) {
    logger.error('Error accepting terms:', error);
    res.status(500).json({ message: 'Error accepting terms' });
  }
};

const deleteUserFiles = async (req) => {
  try {
    const userFiles = await getFiles({ user: req.user.id });
    await processDeleteRequest({
      req,
      files: userFiles,
    });
  } catch (error) {
    logger.error('[deleteUserFiles]', error);
  }
};

const updateUserPluginsController = async (req, res) => {
  const appConfig = await getAppConfig({ role: req.user?.role });
  const { user } = req;
  const { pluginKey, action, auth, isEntityTool } = req.body;
  try {
    if (!isEntityTool) {
      const userPluginsService = await updateUserPluginsService(user, pluginKey, action);

      if (userPluginsService instanceof Error) {
        logger.error('[userPluginsService]', userPluginsService);
        const { status, message } = normalizeHttpError(userPluginsService);
        return res.status(status).send({ message });
      }
    }

    if (auth == null) {
      return res.status(200).send();
    }

    let keys = Object.keys(auth);
    const values = Object.values(auth); // Used in 'install' block

    const isMCPTool = pluginKey.startsWith('mcp_') || pluginKey.includes(Constants.mcp_delimiter);

    // Early exit condition:
    // If keys are empty (meaning auth: {} was likely sent for uninstall, or auth was empty for install)
    // AND it's not web_search (which has special key handling to populate `keys` for uninstall)
    // AND it's NOT (an uninstall action FOR an MCP tool - we need to proceed for this case to clear all its auth)
    // THEN return.
    if (
      keys.length === 0 &&
      pluginKey !== Tools.web_search &&
      !(action === 'uninstall' && isMCPTool)
    ) {
      return res.status(200).send();
    }

    /** @type {number} */
    let status = 200;
    /** @type {string} */
    let message;
    /** @type {IPluginAuth | Error} */
    let authService;

    if (pluginKey === Tools.web_search) {
      /** @type  {TCustomConfig['webSearch']} */
      const webSearchConfig = appConfig?.webSearch;
      keys = extractWebSearchEnvVars({
        keys: action === 'install' ? keys : webSearchKeys,
        config: webSearchConfig,
      });
    }

    if (action === 'install') {
      for (let i = 0; i < keys.length; i++) {
        authService = await updateUserPluginAuth(user.id, keys[i], pluginKey, values[i]);
        if (authService instanceof Error) {
          logger.error('[authService]', authService);
          ({ status, message } = normalizeHttpError(authService));
        }
      }
    } else if (action === 'uninstall') {
      // const isMCPTool was defined earlier
      if (isMCPTool && keys.length === 0) {
        // This handles the case where auth: {} is sent for an MCP tool uninstall.
        // It means "delete all credentials associated with this MCP pluginKey".
        authService = await deleteUserPluginAuth(user.id, null, true, pluginKey);
        if (authService instanceof Error) {
          logger.error(
            `[authService] Error deleting all auth for MCP tool ${pluginKey}:`,
            authService,
          );
          ({ status, message } = normalizeHttpError(authService));
        }
      } else {
        // This handles:
        // 1. Web_search uninstall (keys will be populated with all webSearchKeys if auth was {}).
        // 2. Other tools uninstall (if keys were provided).
        // 3. MCP tool uninstall if specific keys were provided in `auth` (not current frontend behavior).
        // If keys is empty for non-MCP tools (and not web_search), this loop won't run, and nothing is deleted.
        for (let i = 0; i < keys.length; i++) {
          authService = await deleteUserPluginAuth(user.id, keys[i]); // Deletes by authField name
          if (authService instanceof Error) {
            logger.error('[authService] Error deleting specific auth key:', authService);
            ({ status, message } = normalizeHttpError(authService));
          }
        }
      }
    }

    if (status === 200) {
      // If auth was updated successfully, disconnect MCP sessions as they might use these credentials
      if (pluginKey.startsWith(Constants.mcp_prefix)) {
        try {
          const mcpManager = getMCPManager(user.id);
          if (mcpManager) {
            // Extract server name from pluginKey (format: "mcp_<serverName>")
            const serverName = pluginKey.replace(Constants.mcp_prefix, '');
            logger.info(
              `[updateUserPluginsController] Disconnecting MCP server ${serverName} for user ${user.id} after plugin auth update for ${pluginKey}.`,
            );
            await mcpManager.disconnectUserConnection(user.id, serverName);
          }
        } catch (disconnectError) {
          logger.error(
            `[updateUserPluginsController] Error disconnecting MCP connection for user ${user.id} after plugin auth update:`,
            disconnectError,
          );
          // Do not fail the request for this, but log it.
        }
      }
      return res.status(status).send();
    }

    const normalized = normalizeHttpError({ status, message });
    return res.status(normalized.status).send({ message: normalized.message });
  } catch (err) {
    logger.error('[updateUserPluginsController]', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const deleteUserController = async (req, res) => {
  const { user } = req;

  try {
    // DSGVO Audit Log: Account Deletion (BEFORE deletion!)
    await createAuditLog({
      userId: user._id,
      action: 'USER_DELETED',
      details: {
        email: user.email,
        name: user.name,
        deletedAt: new Date().toISOString(),
      },
      req,
      email: user.email,
    });
    
    await deleteMessages({ user: user.id }); // delete user messages
    await deleteAllUserSessions({ userId: user.id }); // delete user sessions
    await Transaction.deleteMany({ user: user.id }); // delete user transactions
    await deleteUserKey({ userId: user.id, all: true }); // delete user keys
    await Balance.deleteMany({ user: user._id }); // delete user balances
    await deletePresets(user.id); // delete user presets
    /* TODO: Delete Assistant Threads */
    try {
      await deleteConvos(user.id); // delete user convos
    } catch (error) {
      logger.error('[deleteUserController] Error deleting user convos, likely no convos', error);
    }
    await deleteUserPluginAuth(user.id, null, true); // delete user plugin auth
    await deleteUserById(user.id); // delete user
    await deleteAllSharedLinks(user.id); // delete user shared links
    await deleteUserFiles(req); // delete user files
    await deleteFiles(null, user.id); // delete database files in case of orphaned files from previous steps
    await deleteToolCalls(user.id); // delete user tool calls
    /* TODO: queue job for cleaning actions and assistants of non-existant users */
    logger.info(`User deleted account. Email: ${user.email} ID: ${user.id}`);
    res.status(200).send({ message: 'User deleted' });
  } catch (err) {
    logger.error('[deleteUserController]', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const verifyEmailController = async (req, res) => {
  try {
    const verifyEmailService = await verifyEmail(req);
    if (verifyEmailService instanceof Error) {
      return res.status(400).json(verifyEmailService);
    } else {
      return res.status(200).json(verifyEmailService);
    }
  } catch (e) {
    logger.error('[verifyEmailController]', e);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const resendVerificationController = async (req, res) => {
  try {
    const result = await resendVerificationEmail(req);
    if (result instanceof Error) {
      return res.status(400).json(result);
    } else {
      return res.status(200).json(result);
    }
  } catch (e) {
    logger.error('[verifyEmailController]', e);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

/**
 * Get security requirements status for current user
 */
const getSecurityStatusController = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const requirePasswordReset = isEnabled(process.env.REQUIRE_INITIAL_PASSWORD_RESET);
    const require2FA = isEnabled(process.env.REQUIRE_INITIAL_2FA_SETUP);
    
    // Only require password reset if user has a password (local auth)
    // Skip for social login users (OAuth, OIDC, SAML, etc.)
    const hasLocalPassword = user.password && user.password.length > 0;
    
    res.status(200).json({
      passwordResetRequired: requirePasswordReset && hasLocalPassword && !user.initialPasswordReset,
      twoFactorRequired: require2FA && !user.initialTwoFactorSetup,
      termsRequired: !user.termsAccepted,
    });
  } catch (error) {
    logger.error('Error fetching security status:', error);
    res.status(500).json({ message: 'Error fetching security status' });
  }
};

/**
 * Mark initial password reset as completed
 */
const initialPasswordResetController = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has a password (not a social login user)
    if (!user.password || user.password.length === 0) {
      return res.status(400).json({ 
        message: 'No password set. This account uses social login and does not require password reset.' 
      });
    }
    
    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }
    
    // Hash and update new password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await User.findByIdAndUpdate(req.user.id, {
      password: hashedPassword,
      initialPasswordReset: true,
    });
    
    // Audit log
    await createAuditLog({
      userId: user._id,
      action: 'INITIAL_PASSWORD_RESET',
      details: {
        email: user.email,
        completedAt: new Date().toISOString(),
      },
      req,
      email: user.email,
    });
    
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error in initial password reset:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

/**
 * Mark initial 2FA setup as completed (called after 2FA is enabled)
 */
const completeTwoFactorSetupController = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA must be enabled first' });
    }
    
    await User.findByIdAndUpdate(req.user.id, {
      initialTwoFactorSetup: true,
    });
    
    // Audit log
    await createAuditLog({
      userId: user._id,
      action: 'INITIAL_2FA_SETUP',
      details: {
        email: user.email,
        completedAt: new Date().toISOString(),
      },
      req,
      email: user.email,
    });
    
    res.status(200).json({ message: '2FA setup completed' });
  } catch (error) {
    logger.error('Error completing 2FA setup:', error);
    res.status(500).json({ message: 'Error completing 2FA setup' });
  }
};

module.exports = {
  getUserController,
  getTermsStatusController,
  acceptTermsController,
  deleteUserController,
  verifyEmailController,
  updateUserPluginsController,
  resendVerificationController,
  getSecurityStatusController,
  initialPasswordResetController,
  completeTwoFactorSetupController,
};
