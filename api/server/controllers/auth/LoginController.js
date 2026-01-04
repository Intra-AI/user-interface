const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { setAuthTokens } = require('~/server/services/AuthService');
const { createAuditLog } = require('~/models/AuditLog');
const { isEnabled } = require('~/server/utils');
const { logger } = require('~/config');

const loginController = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if initial password reset is required
    const requirePasswordReset = isEnabled(process.env.REQUIRE_INITIAL_PASSWORD_RESET);
    const hasLocalPassword = req.user.password && req.user.password.length > 0;
    
    if (requirePasswordReset && hasLocalPassword && !req.user.initialPasswordReset) {
      // User needs to reset password - don't log them in, redirect to password reset
      return res.status(200).json({ 
        passwordResetRequired: true,
        email: req.user.email,
        message: 'Initial password reset required'
      });
    }

    if (req.user.twoFactorEnabled) {
      const tempToken = generate2FATempToken(req.user._id);
      return res.status(200).json({ twoFAPending: true, tempToken });
    }

    const { password: _p, totpSecret: _t, __v, ...user } = req.user;
    user.id = user._id.toString();

    const token = await setAuthTokens(req.user._id, res);

    // DSGVO Audit Log: Erfolgreicher Login
    await createAuditLog({
      userId: user._id,
      action: 'USER_LOGIN',
      details: {
        email: user.email,
        method: 'local',
      },
      req,
      email: user.email,
    });

    return res.status(200).send({ token, user });
  } catch (err) {
    logger.error('[loginController]', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  loginController,
};
