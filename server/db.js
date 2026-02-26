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
      is_admin INTEGER DEFAULT 0,
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

  // Room members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pinned INTEGER DEFAULT 0,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Sessions table (for persistent login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Unread counts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS unread_counts (
      user_id INTEGER NOT NULL,
      room_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      last_message_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, room_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL
    )
  `);

  // Game progress table
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      level INTEGER NOT NULL,
      stars INTEGER NOT NULL CHECK(stars >= 0 AND stars <= 3),
      moves INTEGER,
      time_seconds INTEGER,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_name, level),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Game unlocks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_unlocks (
      user_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      highest_unlocked INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, game_name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_unread_counts_user ON unread_counts(user_id);
    CREATE INDEX IF NOT EXISTS idx_unread_counts_room ON unread_counts(room_id);
    CREATE INDEX IF NOT EXISTS idx_game_progress_user ON game_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_progress_game_level ON game_progress(game_name, level);
  `);

  // Create default "Lobby" room
  const lobby = db.prepare('SELECT id FROM rooms WHERE id = ?').get('lobby');
  if (!lobby) {
    db.prepare(`
      INSERT INTO rooms (id, name, type) VALUES (?, ?, ?)
    `).run('lobby', '大厅', 'group');
  }

  // Create "Game Lobby" room
  const gameLobby = db.prepare('SELECT id FROM rooms WHERE id = ?').get('game-lobby');
  if (!gameLobby) {
    db.prepare(`
      INSERT INTO rooms (id, name, type) VALUES (?, ?, ?)
    `).run('game-lobby', '游戏大厅', 'group');
    console.log('✅ Game Lobby room created');
  }

  // Ensure all existing users are members of game-lobby (default visible to all)
  const allUsers = db.prepare('SELECT id FROM users').all();
  const addMemberStmt = db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)');
  allUsers.forEach(user => {
    addMemberStmt.run('game-lobby', user.id);
  });
  if (allUsers.length > 0) {
    console.log(`✅ Game Lobby made visible to all ${allUsers.length} users`);
  }

  // Database migration: Add pinned column to room_members table (if not exists)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(room_members)").all();
    const hasPinnedColumn = tableInfo.some(col => col.name === 'pinned');

    if (!hasPinnedColumn) {
      console.log('🔄 Database migration: Adding pinned column to room_members table...');
      db.exec('ALTER TABLE room_members ADD COLUMN pinned INTEGER DEFAULT 0');
      console.log('✅ Migration complete');
    }
  } catch (error) {
    console.error('⚠️  Database migration warning:', error.message);
  }

  // Database migration: Add is_admin column to users table (if not exists)
  try {
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasAdminColumn = usersTableInfo.some(col => col.name === 'is_admin');

    if (!hasAdminColumn) {
      console.log('🔄 Database migration: Adding is_admin column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');

      // Make first non-bot user admin
      const firstUser = db.prepare('SELECT id FROM users WHERE is_bot = 0 ORDER BY id ASC LIMIT 1').get();
      if (firstUser) {
        db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUser.id);
        console.log('✅ First user (ID:', firstUser.id, ') promoted to admin');
      }
      console.log('✅ Migration complete');
    }
  } catch (error) {
    console.error('⚠️  Database migration warning:', error.message);
  }

  // Database migration: Add is_banned column to users table (if not exists)
  try {
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasBannedColumn = usersTableInfo.some(col => col.name === 'is_banned');

    if (!hasBannedColumn) {
      console.log('🔄 Database migration: Adding is_banned column to users table...');
      db.exec('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0');
      console.log('✅ Migration complete');
    }
  } catch (error) {
    console.error('⚠️  Database migration warning:', error.message);
  }

  console.log('✅ Database initialized:', dbPath);
}

// Initialize database immediately
initDatabase();

// User operations
const userDb = {
  // Create user
  create: db.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_bot)
    VALUES (?, ?, ?, ?)
  `),

  // Find user by username
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),

  // Find user by ID
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),

  // Update last seen time
  updateLastSeen: db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?'),

  // Update password
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),

  // Get all users
  getAll: db.prepare('SELECT id, username, display_name, is_bot, is_admin, is_banned, last_seen FROM users'),

  // Get online users (active within last 5 minutes)
  getOnline: db.prepare(`
    SELECT id, username, display_name, is_bot, is_admin, last_seen
    FROM users
    WHERE datetime(last_seen) > datetime('now', '-5 minutes')
  `),

  // Set user as admin
  setAdmin: db.prepare('UPDATE users SET is_admin = ? WHERE id = ?'),

  // Ban/unban user
  setBanned: db.prepare('UPDATE users SET is_banned = ? WHERE id = ?'),

  // Delete user
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?')
};

// Room operations
const roomDb = {
  // Create room
  create: db.prepare(`
    INSERT INTO rooms (id, name, type, created_by)
    VALUES (?, ?, ?, ?)
  `),

  // Find room
  findById: db.prepare('SELECT * FROM rooms WHERE id = ?'),

  // Get all user's rooms
  getUserRooms: db.prepare(`
    SELECT r.*, rm.joined_at, rm.pinned
    FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = ?
    ORDER BY
      CASE WHEN r.id = 'lobby' THEN 0 ELSE 1 END,
      rm.pinned DESC,
      rm.joined_at DESC
  `),

  // Add room member
  addMember: db.prepare(`
    INSERT OR IGNORE INTO room_members (room_id, user_id)
    VALUES (?, ?)
  `),

  // Remove room member
  removeMember: db.prepare(`
    DELETE FROM room_members WHERE room_id = ? AND user_id = ?
  `),

  // Get room members
  getMembers: db.prepare(`
    SELECT u.id, u.username, u.display_name, u.is_bot, u.last_seen
    FROM users u
    JOIN room_members rm ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `),

  // Get room member list (to check if room is empty)
  getRoomMembers: db.prepare(`
    SELECT user_id FROM room_members WHERE room_id = ?
  `),

  // Delete room
  delete: db.prepare(`
    DELETE FROM rooms WHERE id = ?
  `),

  // Pin room
  pinRoom: db.prepare(`
    UPDATE room_members SET pinned = 1 WHERE room_id = ? AND user_id = ?
  `),

  // Unpin room
  unpinRoom: db.prepare(`
    UPDATE room_members SET pinned = 0 WHERE room_id = ? AND user_id = ?
  `)
};

// Message operations
const messageDb = {
  // Create message
  create: db.prepare(`
    INSERT INTO messages (room_id, user_id, text)
    VALUES (?, ?, ?)
  `),

  // Get room messages (most recent N messages)
  getByRoom: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.is_bot
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `),

  // Get room messages (paginated)
  getByRoomPaginated: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.is_bot
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ? AND m.id < ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `),

  // Search messages
  search: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.is_bot, r.name as room_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN rooms r ON m.room_id = r.id
    WHERE m.text LIKE ? AND (? IS NULL OR m.room_id = ?)
    ORDER BY m.created_at DESC
    LIMIT 100
  `),

  // Get last message in room
  getLastMessage: db.prepare(`
    SELECT m.*, u.username, u.display_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT 1
  `)
};

// Session operations
const sessionDb = {
  // Create session
  create: db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+30 days'))
  `),

  // Find session
  findByToken: db.prepare(`
    SELECT s.*, u.id as user_id, u.username, u.display_name, u.is_bot, u.is_admin
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `),

  // Delete session
  delete: db.prepare('DELETE FROM sessions WHERE token = ?'),

  // Delete all sessions for a specific user
  deleteByUserId: db.prepare('DELETE FROM sessions WHERE user_id = ?'),

  // Delete expired sessions
  deleteExpired: db.prepare(`
    DELETE FROM sessions WHERE datetime(expires_at) < datetime('now')
  `)
};

// Unread count operations
const unreadDb = {
  // Increment unread count
  incrementUnreadCount: db.prepare(`
    INSERT INTO unread_counts (user_id, room_id, count, last_message_id, updated_at)
    VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, room_id)
    DO UPDATE SET
      count = count + 1,
      last_message_id = excluded.last_message_id,
      updated_at = CURRENT_TIMESTAMP
  `),

  // Clear unread count
  clearUnreadCount: db.prepare(`
    DELETE FROM unread_counts
    WHERE user_id = ? AND room_id = ?
  `),

  // Get user's unread counts for all rooms
  getUserUnreadCounts: db.prepare(`
    SELECT room_id, count, last_message_id, updated_at
    FROM unread_counts
    WHERE user_id = ?
  `),

  // 获取用户总未读数
  getTotalUnreadCount: db.prepare(`
    SELECT SUM(count) as total
    FROM unread_counts
    WHERE user_id = ?
  `),

  // 获取单个房间的未读数
  getRoomUnreadCount: db.prepare(`
    SELECT count
    FROM unread_counts
    WHERE user_id = ? AND room_id = ?
  `)
};

// Game operations
const gameDb = {
  // Get all progress records for a user's game
  getProgress: db.prepare(`
    SELECT level, stars, moves, time_seconds, completed_at
    FROM game_progress
    WHERE user_id = ? AND game_name = ?
    ORDER BY level ASC
  `),

  // Save/update level completion (upserts, keeps best star count)
  saveProgress: db.prepare(`
    INSERT INTO game_progress (user_id, game_name, level, stars, moves, time_seconds)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, game_name, level)
    DO UPDATE SET
      stars = CASE WHEN excluded.stars > stars THEN excluded.stars ELSE stars END,
      moves = excluded.moves,
      time_seconds = excluded.time_seconds,
      completed_at = CURRENT_TIMESTAMP
  `),

  // Get highest unlocked level for a game
  getUnlocked: db.prepare(`
    SELECT highest_unlocked FROM game_unlocks
    WHERE user_id = ? AND game_name = ?
  `),

  // Update highest unlocked level (only increases, never decreases)
  updateUnlocked: db.prepare(`
    INSERT INTO game_unlocks (user_id, game_name, highest_unlocked)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, game_name)
    DO UPDATE SET
      highest_unlocked = CASE
        WHEN excluded.highest_unlocked > highest_unlocked
        THEN excluded.highest_unlocked
        ELSE highest_unlocked
      END,
      updated_at = CURRENT_TIMESTAMP
  `),

  // Get leaderboard for specific game+level (top 10 by stars, then moves/time)
  getLeaderboard: db.prepare(`
    SELECT u.username, u.display_name, gp.stars, gp.moves, gp.time_seconds, gp.completed_at
    FROM game_progress gp
    JOIN users u ON gp.user_id = u.id
    WHERE gp.game_name = ? AND gp.level = ?
    ORDER BY gp.stars DESC,
             COALESCE(gp.moves, 999999) ASC,
             COALESCE(gp.time_seconds, 999999) ASC
    LIMIT 10
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
  } else {
    // 房间已存在，确保两个用户都是成员（处理删除后重新加入的情况）
    roomDb.addMember.run(roomId, userId1);
    roomDb.addMember.run(roomId, userId2);
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
  unreadDb,
  gameDb,
  getPrivateRoomId,
  getOrCreatePrivateRoom
};
