const bcrypt = require('bcryptjs');
const { logger } = require('@librechat/data-schemas');
const { findUser, updateUser } = require('~/models');
const { createAuditLog } = require('~/models/AuditLog');
const { comparePassword } = require('~/models/userMethods');

/**
 * Change Password Controller
 * Allows authenticated users to change their password
 * 
 * Security measures:
 * - Requires current password verification
 * - Only for local auth users (not OAuth)
 * - Creates audit log entry
 * - Enforces minimum password length
 */
const changePasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    // Check minimum password length (consistent with registration)
    const MIN_PASSWORD_LENGTH = parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 8;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ 
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` 
      });
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        message: 'New password must be different from current password' 
      });
    }

    // Get user with password field
    const user = await findUser({ _id: userId }, '+password');
    
    if (!user) {
      logger.error('[changePassword] User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow password change for local auth users
    if (user.provider !== 'local') {
      return res.status(403).json({ 
        message: 'Password change is only available for local authentication users' 
      });
    }

    // Verify current password
    const isPasswordValid = await comparePassword(user, currentPassword);
    if (!isPasswordValid) {
      logger.warn(`[changePassword] Invalid current password attempt for user: ${user.email}`);
      
      // Create audit log for failed attempt
      await createAuditLog({
        userId: user._id,
        action: 'PERSONAL_DATA_CHANGED',
        details: {
          field: 'password',
          success: false,
          reason: 'Invalid current password',
        },
        req,
        email: user.email,
      });

      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await updateUser(userId, { password: hashedPassword });

    // Create audit log for successful password change
    await createAuditLog({
      userId: user._id,
      action: 'PERSONAL_DATA_CHANGED',
      details: {
        field: 'password',
        success: true,
        changedAt: new Date().toISOString(),
      },
      req,
      email: user.email,
    });

    logger.info(`[changePassword] Password changed successfully for user: ${user.email}`);

    return res.status(200).json({ 
      message: 'Password changed successfully' 
    });

  } catch (err) {
    logger.error('[changePasswordController]', err);
    return res.status(500).json({ 
      message: 'An error occurred while changing password' 
    });
  }
};

module.exports = {
  changePasswordController,
};
