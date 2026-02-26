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

    // Find user
    let user = userDb.findByUsername.get(username);

    if (user) {
      // User exists, verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Invalid password' };
      }

      // Update last seen time
      userDb.updateLastSeen.run(user.id);

    } else {
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
    if (newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters' };
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
