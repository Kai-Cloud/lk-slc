const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { userDb, sessionDb, roomDb } = require('./db');

// JWT secret (should be read from environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Register or login user
async function authenticateUser(username, password, isBot = false) {
  try {
    // Validate required parameters
    if (!username || !password) {
      return { success: false, error: 'Username and password required' };
    }

    // Validate username format (alphanumeric, Chinese, underscore, hyphen, max 20 chars)
    const usernameRegex = /^[\w\-\u4E00-\u9FFF]{1,20}$/;
    if (!usernameRegex.test(username)) {
      return {
        success: false,
        error: 'Username must be 1-20 characters and contain only letters, numbers, Chinese characters, underscore, or hyphen. / 用户名必须为1-20个字符，只能包含字母、数字、中文、下划线或横杠。'
      };
    }

    // Validate password length
    if (password.length < 3) {
      return { success: false, error: 'Password must be at least 3 characters. / 密码至少需要3个字符。' };
    }
    if (password.length > 50) {
      return { success: false, error: 'Password cannot exceed 50 characters. / 密码不能超过50个字符。' };
    }

    // Find user
    let user = userDb.findByUsername.get(username);

    if (user) {
      // User exists, check if banned
      if (user.is_banned === 1) {
        return { success: false, error: 'Your account has been banned. Please contact administrator.' };
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        // Increment failed login attempts
        userDb.incrementFailedAttempts.run(user.id);

        // Reload user to get updated failed attempts count
        user = userDb.findById.get(user.id);

        // Auto-ban if 5 or more consecutive failed attempts
        if (user.failed_login_attempts >= 5) {
          userDb.setBanned.run(1, user.id);
          console.log(`🚫 User ${username} (ID: ${user.id}) auto-banned after ${user.failed_login_attempts} failed login attempts`);
          return { success: false, error: 'Your account has been banned due to too many failed login attempts. Please contact administrator.' };
        }

        const remainingAttempts = 5 - user.failed_login_attempts;
        return {
          success: false,
          error: `Invalid password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before account is banned.`
        };
      }

      // Password is correct, reset failed attempts counter
      userDb.resetFailedAttempts.run(user.id);

      // Update last seen time
      userDb.updateLastSeen.run(user.id);

    } else {
      // Check if registration is enabled (unless this is a bot)
      if (!isBot) {
        const registrationSetting = userDb.getSetting.get('registration_enabled');
        const registrationEnabled = !registrationSetting || registrationSetting.value === '1';

        if (!registrationEnabled) {
          return {
            success: false,
            error: 'New user registration is currently disabled. Please contact administrator.'
          };
        }
      }

      // User doesn't exist, auto-register
      const passwordHash = await bcrypt.hash(password, 10);

      // Check if this is the first non-bot user
      const nonBotUsers = userDb.getAll.all().filter(u => u.is_bot === 0);
      const isFirstUser = nonBotUsers.length === 0 && !isBot;

      const result = userDb.create.run(
        username,
        passwordHash,
        username, // Default display name = username
        isBot ? 1 : 0
      );

      user = userDb.findById.get(result.lastInsertRowid);

      // Make first non-bot user admin
      if (isFirstUser) {
        userDb.setAdmin.run(1, user.id);
        user = userDb.findById.get(user.id); // Reload to get updated admin status
        console.log(`👑 First user ${username} promoted to admin`);
      }

      // Auto-join lobby
      roomDb.addMember.run('lobby', user.id);

      // Auto-create private chat with game-bot (if game-bot exists)
      const gameBot = userDb.findByUsername.get('game-bot');
      if (gameBot) {
        const { getOrCreatePrivateRoom } = require('./db');
        getOrCreatePrivateRoom(user.id, gameBot.id);
      }

      console.log(`✅ New user registered: ${username} (ID: ${user.id})`);
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Save to database
    sessionDb.create.run(token, user.id);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isBot: user.is_bot === 1,
        isAdmin: user.is_admin === 1
      },
      token
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed: ' + error.message };
  }
}

// Verify Token
function verifyToken(token) {
  try {
    // Check session in database
    const session = sessionDb.findByToken.get(token);
    console.log('🔍 Auth - Session from DB:', session);

    if (!session) {
      console.log('❌ Auth - No session found');
      return null;
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    const userObj = {
      id: session.user_id,
      username: session.username,
      displayName: session.display_name,
      isBot: session.is_bot === 1,
      isAdmin: session.is_admin === 1
    };

    console.log('🔍 Auth - Returning user object:', userObj);
    console.log('🔍 Auth - isAdmin value:', userObj.isAdmin);
    console.log('🔍 Auth - session.is_admin from DB:', session.is_admin);

    return userObj;

  } catch (error) {
    console.log('❌ Auth - Error verifying token:', error.message);
    return null;
  }
}

// Logout
function logout(token) {
  try {
    sessionDb.delete.run(token);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Clean up expired sessions
function cleanupExpiredSessions() {
  try {
    const result = sessionDb.deleteExpired.run();
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired sessions`);
    }
  } catch (error) {
    console.error('Session cleanup failed:', error);
  }
}

// Change password
async function changePassword(userId, currentPassword, newPassword) {
  try {
    // Validate required parameters
    if (!userId || !currentPassword || !newPassword) {
      return { success: false, error: 'Incomplete parameters' };
    }

    // Validate new password length
    if (newPassword.length < 3) {
      return { success: false, error: 'New password must be at least 3 characters' };
    }
    if (newPassword.length > 50) {
      return { success: false, error: 'New password cannot exceed 50 characters' };
    }

    // Find user
    const user = userDb.findById.get(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Check if new password is same as old password
    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      return { success: false, error: 'New password cannot be the same as current password' };
    }

    // Generate new password hash
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    userDb.updatePassword.run(newPasswordHash, userId);

    // Delete all sessions for this user (force re-login)
    sessionDb.deleteByUserId.run(userId);

    console.log(`✅ User ${user.username} (ID: ${userId}) changed password successfully`);

    return { success: true };

  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Failed to change password: ' + error.message };
  }
}

// Periodically clean up expired sessions (once per hour)
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  authenticateUser,
  verifyToken,
  logout,
  cleanupExpiredSessions,
  changePassword,
  JWT_SECRET
};
