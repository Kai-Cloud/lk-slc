const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保 data 目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chat.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库表
function initDatabase() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      is_bot INTEGER DEFAULT 0,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 房间表
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('group', 'private')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 房间成员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 会话表（用于持久化登录）
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  // 创建默认 "大厅" 房间
  const lobby = db.prepare('SELECT id FROM rooms WHERE id = ?').get('lobby');
  if (!lobby) {
    db.prepare(`
      INSERT INTO rooms (id, name, type) VALUES (?, ?, ?)
    `).run('lobby', '大厅', 'group');
  }

  console.log('✅ 数据库初始化完成:', dbPath);
}

// 立即初始化数据库
initDatabase();

// 用户操作
const userDb = {
  // 创建用户
  create: db.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_bot)
    VALUES (?, ?, ?, ?)
  `),

  // 通过用户名查找用户
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),

  // 通过 ID 查找用户
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),

  // 更新最后在线时间
  updateLastSeen: db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?'),

  // 更新密码
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),

  // 获取所有用户
  getAll: db.prepare('SELECT id, username, display_name, is_bot, last_seen FROM users'),

  // 获取在线用户（最近 5 分钟内活跃）
  getOnline: db.prepare(`
    SELECT id, username, display_name, is_bot, last_seen
    FROM users
    WHERE datetime(last_seen) > datetime('now', '-5 minutes')
  `)
};

// 房间操作
const roomDb = {
  // 创建房间
  create: db.prepare(`
    INSERT INTO rooms (id, name, type, created_by)
    VALUES (?, ?, ?, ?)
  `),

  // 查找房间
  findById: db.prepare('SELECT * FROM rooms WHERE id = ?'),

  // 获取用户的所有房间
  getUserRooms: db.prepare(`
    SELECT r.*, rm.joined_at
    FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = ?
    ORDER BY rm.joined_at DESC
  `),

  // 添加房间成员
  addMember: db.prepare(`
    INSERT OR IGNORE INTO room_members (room_id, user_id)
    VALUES (?, ?)
  `),

  // 移除房间成员
  removeMember: db.prepare(`
    DELETE FROM room_members WHERE room_id = ? AND user_id = ?
  `),

  // 获取房间成员
  getMembers: db.prepare(`
    SELECT u.id, u.username, u.display_name, u.is_bot, u.last_seen
    FROM users u
    JOIN room_members rm ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `),

  // 获取房间成员列表（用于检查房间是否为空）
  getRoomMembers: db.prepare(`
    SELECT user_id FROM room_members WHERE room_id = ?
  `),

  // 删除房间
  delete: db.prepare(`
    DELETE FROM rooms WHERE id = ?
  `)
};

// 消息操作
const messageDb = {
  // 创建消息
  create: db.prepare(`
    INSERT INTO messages (room_id, user_id, text)
    VALUES (?, ?, ?)
  `),

  // 获取房间消息（最近 N 条）
  getByRoom: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.is_bot
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `),

  // 获取房间消息（分页）
  getByRoomPaginated: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.is_bot
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ? AND m.id < ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `),

  // 搜索消息
  search: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.is_bot, r.name as room_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN rooms r ON m.room_id = r.id
    WHERE m.text LIKE ? AND (? IS NULL OR m.room_id = ?)
    ORDER BY m.created_at DESC
    LIMIT 100
  `),

  // 获取房间最后一条消息
  getLastMessage: db.prepare(`
    SELECT m.*, u.username, u.display_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT 1
  `)
};

// 会话操作
const sessionDb = {
  // 创建会话
  create: db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+30 days'))
  `),

  // 查找会话
  findByToken: db.prepare(`
    SELECT s.*, u.id as user_id, u.username, u.display_name, u.is_bot
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `),

  // 删除会话
  delete: db.prepare('DELETE FROM sessions WHERE token = ?'),

  // 删除指定用户的所有会话
  deleteByUserId: db.prepare('DELETE FROM sessions WHERE user_id = ?'),

  // 删除过期会话
  deleteExpired: db.prepare(`
    DELETE FROM sessions WHERE datetime(expires_at) < datetime('now')
  `)
};

// 工具函数：获取私聊房间 ID
function getPrivateRoomId(userId1, userId2) {
  // 确保 room ID 一致（小的 ID 在前）
  const [id1, id2] = [userId1, userId2].sort((a, b) => a - b);
  return `private_${id1}_${id2}`;
}

// 工具函数：创建或获取私聊房间
function getOrCreatePrivateRoom(userId1, userId2) {
  const roomId = getPrivateRoomId(userId1, userId2);
  let room = roomDb.findById.get(roomId);

  if (!room) {
    // 创建私聊房间
    const user1 = userDb.findById.get(userId1);
    const user2 = userDb.findById.get(userId2);

    roomDb.create.run(
      roomId,
      `${user1.display_name || user1.username} & ${user2.display_name || user2.username}`,
      'private',
      userId1
    );

    // 添加两个成员
    roomDb.addMember.run(roomId, userId1);
    roomDb.addMember.run(roomId, userId2);

    room = roomDb.findById.get(roomId);
  }

  return room;
}

// 导出
module.exports = {
  db,
  initDatabase,
  userDb,
  roomDb,
  messageDb,
  sessionDb,
  getPrivateRoomId,
  getOrCreatePrivateRoom
};
