const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { userDb, sessionDb, roomDb } = require('./db');

// JWT 密钥（生产环境应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// 注册或登录用户
async function authenticateUser(username, password, isBot = false) {
  try {
    // 验证必填参数
    if (!username || !password) {
      return { success: false, error: '用户名和密码不能为空' };
    }

    // 查找用户
    let user = userDb.findByUsername.get(username);

    if (user) {
      // 用户存在，验证密码
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: '密码错误' };
      }

      // 更新最后在线时间
      userDb.updateLastSeen.run(user.id);

    } else {
      // 用户不存在，自动注册
      const passwordHash = await bcrypt.hash(password, 10);
      const result = userDb.create.run(
        username,
        passwordHash,
        username, // 默认显示名 = 用户名
        isBot ? 1 : 0
      );

      user = userDb.findById.get(result.lastInsertRowid);

      // 自动加入大厅
      roomDb.addMember.run('lobby', user.id);

      console.log(`✅ 新用户注册: ${username} (ID: ${user.id})`);
    }

    // 生成 JWT Token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 保存到数据库
    sessionDb.create.run(token, user.id);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isBot: user.is_bot === 1
      },
      token
    };

  } catch (error) {
    console.error('认证错误:', error);
    return { success: false, error: '认证失败: ' + error.message };
  }
}

// 验证 Token
function verifyToken(token) {
  try {
    // 检查数据库中的会话
    const session = sessionDb.findByToken.get(token);
    if (!session) {
      return null;
    }

    // 验证 JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    return {
      id: session.user_id,
      username: session.username,
      displayName: session.display_name,
      isBot: session.is_bot === 1
    };

  } catch (error) {
    return null;
  }
}

// 登出
function logout(token) {
  try {
    sessionDb.delete.run(token);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 清理过期会话
function cleanupExpiredSessions() {
  try {
    const result = sessionDb.deleteExpired.run();
    if (result.changes > 0) {
      console.log(`🧹 清理了 ${result.changes} 个过期会话`);
    }
  } catch (error) {
    console.error('清理会话失败:', error);
  }
}

// 修改密码
async function changePassword(userId, currentPassword, newPassword) {
  try {
    // 验证必填参数
    if (!userId || !currentPassword || !newPassword) {
      return { success: false, error: '参数不完整' };
    }

    // 验证新密码长度
    if (newPassword.length < 6) {
      return { success: false, error: '新密码至少需要6位字符' };
    }

    // 查找用户
    const user = userDb.findById.get(userId);
    if (!user) {
      return { success: false, error: '用户不存在' };
    }

    // 验证当前密码
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return { success: false, error: '当前密码错误' };
    }

    // 检查新密码是否与旧密码相同
    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      return { success: false, error: '新密码不能与当前密码相同' };
    }

    // 生成新的密码哈希
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    userDb.updatePassword.run(newPasswordHash, userId);

    // 删除该用户的所有会话（强制重新登录）
    sessionDb.deleteByUserId.run(userId);

    console.log(`✅ 用户 ${user.username} (ID: ${userId}) 修改密码成功`);

    return { success: true };

  } catch (error) {
    console.error('修改密码错误:', error);
    return { success: false, error: '修改密码失败: ' + error.message };
  }
}

// 定期清理过期会话（每小时一次）
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  authenticateUser,
  verifyToken,
  logout,
  cleanupExpiredSessions,
  changePassword,
  JWT_SECRET
};
