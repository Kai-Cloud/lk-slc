const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const { db, initDatabase, userDb, roomDb, messageDb, unreadDb, gameDb, getOrCreatePrivateRoom } = require('./db');
const { authenticateUser, verifyToken, changePassword } = require('./auth');

// Initialize database
initDatabase();

// Create Express application
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve lk-sgl game files as external plugin
// Maps /games/* -> ../lk-sgl/*
app.use('/games', express.static(path.join(__dirname, '..', '..', 'lk-sgl')));
console.log('📦 Game plugin directory:', path.join(__dirname, '..', '..', 'lk-sgl'));

// Online users mapping { userId: socketId }
const onlineUsers = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`📱 New connection: ${socket.id}`);

  let currentUser = null;

  // Login event
  socket.on('login', async (data) => {
    const { username, password } = data;

    if (!username || !password) {
      socket.emit('error', { message: 'Username and password cannot be empty' });
      return;
    }

    const result = await authenticateUser(username, password);

    if (!result.success) {
      socket.emit('loginError', { message: result.error });
      return;
    }

    currentUser = result.user;
    socket.userId = currentUser.id;

    // Record online status
    onlineUsers.set(currentUser.id, socket.id);

    // Update last seen time
    userDb.updateLastSeen.run(currentUser.id);

    // Get user's all rooms
    const rooms = roomDb.getUserRooms.all(currentUser.id);

    // Join all rooms (Socket.io rooms)
    rooms.forEach(room => {
      socket.join(room.id);
    });

    // Send login success
    socket.emit('loginSuccess', {
      user: currentUser,
      token: result.token
    });

    // Send room list
    const roomsWithLastMessage = rooms.map(room => {
      const lastMessage = messageDb.getLastMessage.get(room.id);
      return {
        ...room,
        lastMessage
      };
    });

    socket.emit('roomList', roomsWithLastMessage);

    // Notify other users that user is online
    io.emit('userOnline', {
      id: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName
    });

    console.log(`✅ User logged in: ${currentUser.username} (ID: ${currentUser.id})`);
  });

  // Token login (auto login)
  socket.on('loginWithToken', (data) => {
    const { token } = data;

    if (!token) {
      socket.emit('loginError', { message: 'Invalid token' });
      return;
    }

    const user = verifyToken(token);
    console.log('🔍 Server - verifyToken result:', user);

    if (!user) {
      socket.emit('loginError', { message: 'Token expired, please login again' });
      return;
    }

    currentUser = user;
    socket.userId = user.id;
    console.log('🔍 Server - currentUser set:', currentUser);
    console.log('🔍 Server - isAdmin value:', currentUser.isAdmin);

    // Record online status
    onlineUsers.set(user.id, socket.id);

    // Update last seen time
    userDb.updateLastSeen.run(user.id);

    // If user is admin, ensure they're in all special rooms (admins always have access)
    if (user.isAdmin) {
      const specialRoomIds = ['game-lobby'];
      specialRoomIds.forEach(roomId => {
        roomDb.addMember.run(roomId, user.id);
      });
    }

    // Get user's all rooms
    const rooms = roomDb.getUserRooms.all(user.id);

    // Ensure lobby is always pinned at top
    const lobbyRoom = rooms.find(r => r.id === 'lobby');
    if (lobbyRoom && !lobbyRoom.pinned) {
      roomDb.pinRoom.run('lobby', user.id);
      lobbyRoom.pinned = 1;
    }

    // Join all rooms
    rooms.forEach(room => {
      socket.join(room.id);
    });

    // Send login success
    console.log('🔍 Server - Sending loginSuccess with user:', user);
    socket.emit('loginSuccess', { user });

    // Load unread counts
    const unreadCounts = unreadDb.getUserUnreadCounts.all(user.id);
    const unreadMap = {};
    unreadCounts.forEach(item => {
      unreadMap[item.room_id] = item.count;
    });

    // Send room list (with unread counts)
    const roomsWithLastMessage = rooms.map(room => {
      const lastMessage = messageDb.getLastMessage.get(room.id);
      return {
        ...room,
        lastMessage,
        unreadCount: unreadMap[room.id] || 0
      };
    });

    socket.emit('roomList', roomsWithLastMessage);

    // Send total unread count
    const totalUnread = unreadDb.getTotalUnreadCount.get(user.id);
    socket.emit('totalUnreadCount', { total: totalUnread?.total || 0 });

    // Notify other users that user is online
    io.emit('userOnline', {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    });

    console.log(`✅ User auto-logged in: ${user.username} (ID: ${user.id})`);
  });

  // Load room messages
  socket.on('loadMessages', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { roomId, limit = 50, before, skipClearUnread } = data;

    // Only clear unread count when not skipping (default: clear)
    if (!skipClearUnread) {
      unreadDb.clearUnreadCount.run(currentUser.id, roomId);

      // Notify client that unread count is cleared
      socket.emit('unreadCountUpdate', { roomId, count: 0 });

      // Update total unread count
      const totalUnread = unreadDb.getTotalUnreadCount.get(currentUser.id);
      socket.emit('totalUnreadCount', { total: totalUnread?.total || 0 });
    }

    let messages;
    if (before) {
      messages = messageDb.getByRoomPaginated.all(roomId, before, limit);
    } else {
      messages = messageDb.getByRoom.all(roomId, limit);
    }

    socket.emit('messages', {
      roomId,
      messages: messages.reverse() // Chronological order
    });
  });

  // Clear unread count (triggered by user interaction)
  socket.on('clearUnread', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { roomId } = data;

    // Clear unread count for this room
    unreadDb.clearUnreadCount.run(currentUser.id, roomId);

    // Notify client that unread count is cleared
    socket.emit('unreadCountUpdate', { roomId, count: 0 });

    // Update total unread count
    const totalUnread = unreadDb.getTotalUnreadCount.get(currentUser.id);
    socket.emit('totalUnreadCount', { total: totalUnread?.total || 0 });

    console.log(`🔔 User ${currentUser.username} cleared unread count for room ${roomId}`);
  });

  // Send message
  socket.on('sendMessage', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { roomId, text } = data;

    if (!text || text.trim() === '') {
      return;
    }

    // Update user last seen time
    userDb.updateLastSeen.run(currentUser.id);

    // Check if user is in room
    const room = roomDb.findById.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room does not exist' });
      return;
    }

    // Save message to database
    const result = messageDb.create.run(roomId, currentUser.id, text.trim());
    const messageId = result.lastInsertRowid;

    // Build message object
    const message = {
      id: messageId,
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
      display_name: currentUser.displayName,
      is_bot: currentUser.isBot,
      text: text.trim(),
      created_at: new Date().toISOString()
    };

    // Broadcast to room
    io.to(roomId).emit('message', message);

    // Get current room members
    const members = roomDb.getMembers.all(roomId);
    const memberIds = new Set(members.map(m => m.id));

    // If private room, check if need to re-add deleted members
    if (room.type === 'private') {
      const match = roomId.match(/^private_(\d+)_(\d+)$/);
      if (match) {
        const [_, id1Str, id2Str] = match;
        const expectedUserIds = [parseInt(id1Str), parseInt(id2Str)];

        // Find users that should be in room but not in member list (means they were deleted)
        expectedUserIds.forEach(userId => {
          if (!memberIds.has(userId) && userId !== currentUser.id) {
            // Re-add member
            roomDb.addMember.run(roomId, userId);
            console.log(`🔄 Auto re-added user ${userId} to private room ${roomId}`);

            // Increment unread count
            unreadDb.incrementUnreadCount.run(userId, roomId, messageId);

            // If user is online, push new room and unread count notification
            const targetSocketId = onlineUsers.get(userId);
            if (targetSocketId) {
              const targetSocket = io.sockets.sockets.get(targetSocketId);
              if (targetSocket) {
                targetSocket.join(roomId);
              }

              // Re-fetch complete room info (including pinned field)
              const userRooms = roomDb.getUserRooms.all(userId);
              const updatedRoom = userRooms.find(r => r.id === roomId);
              const roomWithDetails = {
                ...updatedRoom,
                members: roomDb.getMembers.all(roomId),
                lastMessage: message,
                unreadCount: 1
              };

              // Push new room notification
              io.to(targetSocketId).emit('newRoom', roomWithDetails);

              // Push unread count
              io.to(targetSocketId).emit('unreadCountUpdate', {
                roomId: roomId,
                count: 1
              });

              // Push total unread count
              const totalUnread = unreadDb.getTotalUnreadCount.get(userId);
              io.to(targetSocketId).emit('totalUnreadCount', {
                total: totalUnread?.total || 0
              });

              console.log(`📩 Notified user ${userId} of new private message`);
            }
          }
        });
      }
    }

    // Increment unread count for existing members (excluding sender and newly re-added members)
    members.forEach(member => {
      if (member.id !== currentUser.id) {
        // Increment unread count
        unreadDb.incrementUnreadCount.run(member.id, roomId, messageId);

        // If user is online, push unread count update
        const targetSocketId = onlineUsers.get(member.id);
        if (targetSocketId) {
          // Query latest unread count
          const unreadResult = unreadDb.getRoomUnreadCount.get(member.id, roomId);
          const newCount = unreadResult ? unreadResult.count : 1;

          io.to(targetSocketId).emit('unreadCountUpdate', {
            roomId: roomId,
            count: newCount
          });

          // Also push total unread count update
          const totalUnread = unreadDb.getTotalUnreadCount.get(member.id);
          io.to(targetSocketId).emit('totalUnreadCount', {
            total: totalUnread?.total || 0
          });
        }
      }
    });

    // Broadcast online user update (because last_seen changed)
    io.emit('userStatusUpdate', {
      id: currentUser.id,
      username: currentUser.username,
      lastSeen: new Date().toISOString()
    });

    console.log(`💬 [${room.name}] ${currentUser.username}: ${text.substring(0, 50)}...`);
  });

  // Create private chat
  socket.on('createPrivateChat', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { targetUserId } = data;

    if (targetUserId === currentUser.id) {
      socket.emit('error', { message: 'Cannot chat with yourself' });
      return;
    }

    // Create or get private room
    const room = getOrCreatePrivateRoom(currentUser.id, targetUserId);

    // Join room
    socket.join(room.id);

    // If target user is online, have them join too
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.join(room.id);
      }

      // Check if target user already has this room in their list
      const targetRooms = roomDb.getUserRooms.all(targetUserId);
      const targetHasRoom = targetRooms.some(r => r.id === room.id);

      // Only notify target if they don't have this room (avoid duplicates)
      if (!targetHasRoom) {
        // Query target's room info (including pinned field)
        const refreshedTargetRooms = roomDb.getUserRooms.all(targetUserId);
        const targetRoomData = refreshedTargetRooms.find(r => r.id === room.id);

        const roomWithMembers = {
          ...(targetRoomData || room),
          members: roomDb.getMembers.all(room.id),
          pinned: targetRoomData?.pinned || 0
        };
        io.to(targetSocketId).emit('newRoom', roomWithMembers);
      }
    }

    // Return room info to current user
    socket.emit('roomCreated', room);

    console.log(`🔒 Private chat created/rejoined: ${currentUser.username} <-> User#${targetUserId}`);
  });

  // Get online users list
  socket.on('getOnlineUsers', () => {
    const users = userDb.getOnline.all();
    socket.emit('onlineUsers', users);
  });

  // Search messages
  socket.on('searchMessages', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { query, roomId } = data;

    if (!query || query.trim() === '') {
      socket.emit('searchResults', []);
      return;
    }

    const results = messageDb.search.all(
      `%${query}%`,
      roomId || null,
      roomId || null
    );

    socket.emit('searchResults', results);
  });

  // Keep alive heartbeat
  socket.on('keepAlive', () => {
    if (currentUser) {
      userDb.updateLastSeen.run(currentUser.id);
    }
  });

  // Delete room
  socket.on('deleteRoom', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { roomId } = data;

    // Cannot delete lobby
    if (roomId === 'lobby') {
      socket.emit('error', { message: 'Cannot delete lobby' });
      return;
    }

    // Check if room exists
    const room = roomDb.findById.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room does not exist' });
      return;
    }

    // Remove current user from room
    roomDb.removeMember.run(roomId, currentUser.id);

    // Leave Socket.io room
    socket.leave(roomId);

    // Notify current user of successful deletion
    socket.emit('roomDeleted', { roomId });

    // Private room: Only remove member relationship, don't delete room itself (keep message history)
    if (room.type === 'private') {
      console.log(`👋 User ${currentUser.username} deleted private room ${roomId} (room preserved, can be reactivated via messages)`);
    } else {
      // Group room: Check if there are other members
      const remainingMembers = roomDb.getRoomMembers.all(roomId);

      // If group room has no members left, delete room
      if (remainingMembers.length === 0) {
        roomDb.delete.run(roomId);
        console.log(`🗑️ Group room deleted: ${room.name} (ID: ${roomId})`);
      } else {
        console.log(`👋 User ${currentUser.username} left group room: ${room.name}`);
      }
    }
  });

  // Pin/unpin room
  socket.on('togglePinRoom', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { roomId, pinned } = data;

    // Lobby cannot be manually unpinned
    if (roomId === 'lobby' && !pinned) {
      socket.emit('error', { message: 'Lobby is always pinned, cannot be unpinned' });
      return;
    }

    // Update database
    if (pinned) {
      roomDb.pinRoom.run(roomId, currentUser.id);
    } else {
      roomDb.unpinRoom.run(roomId, currentUser.id);
    }

    // Notify client to update room list
    const rooms = roomDb.getUserRooms.all(currentUser.id);
    const roomsWithLastMessage = rooms.map(room => {
      const lastMessage = messageDb.getLastMessage.get(room.id);
      return { ...room, lastMessage };
    });

    socket.emit('roomList', roomsWithLastMessage);

    console.log(`📌 User ${currentUser.username} ${pinned ? 'pinned' : 'unpinned'} room: ${roomId}`);
  });

  // Game progress: Load game progress for current user
  socket.on('getGameProgress', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: 'Please login first' });
      return;
    }

    const { gameName } = data;
    const progressRecords = gameDb.getProgress.all(currentUser.id, gameName);

    const starsMap = {};
    progressRecords.forEach(p => {
      starsMap[p.level] = p.stars;
    });

    const unlockData = gameDb.getUnlocked.get(currentUser.id, gameName);
    const highestUnlocked = unlockData?.highest_unlocked || 1;

    socket.emit('gameProgress', {
      gameName,
      stars: starsMap,
      unlocked: highestUnlocked
    });

    console.log(`📊 User ${currentUser.username} loaded progress for ${gameName}`);
  });

  // Game progress: Save level completion
  socket.on('saveGameProgress', (data) => {
    if (!currentUser) return;

    const { gameName, level, stars, moves, timeSeconds } = data;
    if (!gameName || !level || stars === undefined) return;

    gameDb.saveProgress.run(
      currentUser.id,
      gameName,
      level,
      stars,
      moves || null,
      timeSeconds || null
    );

    const currentUnlock = gameDb.getUnlocked.get(currentUser.id, gameName);
    const currentMax = currentUnlock?.highest_unlocked || 1;
    if (level >= currentMax && stars > 0) {
      gameDb.updateUnlocked.run(currentUser.id, gameName, level + 1);
    }

    socket.emit('gameProgressSaved', {
      gameName,
      level,
      stars,
      unlocked: Math.max(currentMax, level + 1)
    });

    console.log(`🎮 ${currentUser.username} completed ${gameName} L${level} ⭐${stars}`);
  });

  // Game leaderboard: Get leaderboard for a specific game and level
  socket.on('getGameLeaderboard', (data) => {
    const { gameName, level } = data;
    if (!gameName || !level) return;

    const leaderboard = gameDb.getLeaderboard.all(gameName, level);
    socket.emit('gameLeaderboard', { gameName, level, leaderboard });
  });

  // Admin: Get all users
  socket.on('adminGetAllUsers', () => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const users = userDb.getAll.all();
    socket.emit('adminUsersList', { users });
  });

  // Admin: Set user admin status
  socket.on('adminSetUserAdmin', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { userId, isAdmin } = data;
    userDb.setAdmin.run(isAdmin ? 1 : 0, userId);

    const user = userDb.findById.get(userId);
    socket.emit('adminActionSuccess', {
      message: `用户 ${user.username} ${isAdmin ? '已设置' : '已取消'}管理员权限`
    });

    console.log(`👑 Admin ${currentUser.username} ${isAdmin ? 'promoted' : 'demoted'} user ${user.username} (ID: ${userId})`);
  });

  // Admin: Ban/Unban user
  socket.on('adminSetUserBanned', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { userId, isBanned } = data;
    const user = userDb.findById.get(userId);

    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    if (user.id === currentUser.id) {
      socket.emit('error', { message: 'Cannot ban yourself' });
      return;
    }

    userDb.setBanned.run(isBanned ? 1 : 0, userId);

    // If banning, kick the user offline
    if (isBanned) {
      const targetSocketId = onlineUsers.get(userId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('forcedLogout', {
            reason: 'Your account has been banned by administrator'
          });
          targetSocket.disconnect(true);
        }
        onlineUsers.delete(userId);
      }
    }

    socket.emit('adminActionSuccess', {
      message: `用户 ${user.username} 已${isBanned ? '封禁' : '解封'}`
    });

    console.log(`🚫 Admin ${currentUser.username} ${isBanned ? 'banned' : 'unbanned'} user ${user.username} (ID: ${userId})`);
  });

  // Admin: Reset user password
  socket.on('adminResetUserPassword', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { userId, newPassword } = data;

    if (!newPassword || newPassword.length < 6) {
      socket.emit('error', { message: 'Password must be at least 6 characters' });
      return;
    }

    const user = userDb.findById.get(userId);
    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    // Hash new password and update
    const bcrypt = require('bcryptjs');
    bcrypt.hash(newPassword, 10, (err, hash) => {
      if (err) {
        socket.emit('error', { message: 'Failed to reset password' });
        return;
      }

      userDb.updatePassword.run(hash, userId);

      // Delete all sessions for this user (force re-login)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

      // If user is online, kick them out
      const targetSocketId = onlineUsers.get(userId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('forcedLogout', {
            reason: 'Your password has been reset by administrator. Please login again.'
          });
          targetSocket.disconnect(true);
        }
        onlineUsers.delete(userId);
      }

      socket.emit('adminActionSuccess', {
        message: `用户 ${user.username} 密码已重置为: ${newPassword}`
      });

      console.log(`🔑 Admin ${currentUser.username} reset password for user ${user.username} (ID: ${userId})`);
    });
  });

  // Admin: Delete user
  socket.on('adminDeleteUser', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { userId } = data;
    const user = userDb.findById.get(userId);

    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    if (user.id === currentUser.id) {
      socket.emit('error', { message: 'Cannot delete yourself' });
      return;
    }

    try {
      // Manually delete related records before deleting user
      // 1. Delete sessions
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

      // 2. Delete room memberships
      db.prepare('DELETE FROM room_members WHERE user_id = ?').run(userId);

      // 3. Delete messages (set created_by to NULL for rooms created by this user)
      db.prepare('UPDATE rooms SET created_by = NULL WHERE created_by = ?').run(userId);

      // 4. Delete messages
      db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);

      // 5. Delete unread counts (already has CASCADE)
      db.prepare('DELETE FROM unread_counts WHERE user_id = ?').run(userId);

      // 6. Delete game progress (already has CASCADE)
      db.prepare('DELETE FROM game_progress WHERE user_id = ?').run(userId);

      // 7. Delete game unlocks (already has CASCADE)
      db.prepare('DELETE FROM game_unlocks WHERE user_id = ?').run(userId);

      // 8. Finally delete the user
      userDb.deleteUser.run(userId);

      socket.emit('adminActionSuccess', {
        message: `用户 ${user.username} 已删除`
      });

      console.log(`🗑️  Admin ${currentUser.username} deleted user ${user.username} (ID: ${userId})`);

    } catch (error) {
      console.error('Error deleting user:', error);
      socket.emit('error', { message: '删除用户失败: ' + error.message });
    }
  });

  // Admin: Get special rooms (game-lobby, etc.)
  socket.on('adminGetSpecialRooms', () => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    // Get special rooms (currently just game-lobby)
    const specialRoomIds = ['game-lobby'];
    const rooms = [];

    specialRoomIds.forEach(roomId => {
      const room = roomDb.findById.get(roomId);
      if (room) {
        const members = roomDb.getMembers.all(roomId);
        rooms.push({
          ...room,
          members
        });
      }
    });

    const allUsers = userDb.getAll.all();

    socket.emit('adminSpecialRoomsList', { rooms, allUsers });
  });

  // Admin: Add user to room
  socket.on('adminAddUserToRoom', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { roomId, userId } = data;
    roomDb.addMember.run(roomId, userId);

    const user = userDb.findById.get(userId);
    socket.emit('adminActionSuccess', {
      message: `用户 ${user.username} 已添加到房间`
    });

    // If user is online, send them the room update
    const targetSocketId = onlineUsers.get(userId);
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        const rooms = roomDb.getUserRooms.all(userId);
        const roomsWithLastMessage = rooms.map(room => {
          const lastMessage = messageDb.getLastMessage.get(room.id);
          return { ...room, lastMessage };
        });
        targetSocket.emit('roomList', roomsWithLastMessage);
      }
    }

    console.log(`➕ Admin ${currentUser.username} added user ${user.username} to room ${roomId}`);
  });

  // Admin: Remove user from room
  socket.on('adminRemoveUserFromRoom', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { roomId, userId } = data;
    roomDb.removeMember.run(roomId, userId);

    const user = userDb.findById.get(userId);
    socket.emit('adminActionSuccess', {
      message: `用户 ${user.username} 已从房间移除`
    });

    // If user is online, send them the room update
    const targetSocketId = onlineUsers.get(userId);
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        const rooms = roomDb.getUserRooms.all(userId);
        const roomsWithLastMessage = rooms.map(room => {
          const lastMessage = messageDb.getLastMessage.get(room.id);
          return { ...room, lastMessage };
        });
        targetSocket.emit('roomList', roomsWithLastMessage);
      }
    }

    console.log(`➖ Admin ${currentUser.username} removed user ${user.username} from room ${roomId}`);
  });

  // Admin: Toggle room visibility for all non-admin users
  socket.on('adminToggleRoomVisibility', (data) => {
    if (!currentUser || !currentUser.isAdmin) {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }

    const { roomId, makeVisible } = data;

    // Get all non-admin users
    const allUsers = userDb.getAll.all();
    const nonAdminUsers = allUsers.filter(u => u.is_admin === 0);

    let successCount = 0;

    if (makeVisible) {
      // Add all non-admin users to the room
      nonAdminUsers.forEach(user => {
        roomDb.addMember.run(roomId, user.id);

        // If user is online, send them the room update
        const targetSocketId = onlineUsers.get(user.id);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            const rooms = roomDb.getUserRooms.all(user.id);
            const roomsWithLastMessage = rooms.map(room => {
              const lastMessage = messageDb.getLastMessage.get(room.id);
              return { ...room, lastMessage };
            });
            targetSocket.emit('roomList', roomsWithLastMessage);
          }
        }
        successCount++;
      });

      socket.emit('adminActionSuccess', {
        message: `已将 ${successCount} 名非管理员用户添加到房间`
      });
      console.log(`🌐 Admin ${currentUser.username} made room ${roomId} visible to all (${successCount} users)`);

    } else {
      // Remove all non-admin users from the room
      nonAdminUsers.forEach(user => {
        roomDb.removeMember.run(roomId, user.id);

        // If user is online, send them the room update
        const targetSocketId = onlineUsers.get(user.id);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            const rooms = roomDb.getUserRooms.all(user.id);
            const roomsWithLastMessage = rooms.map(room => {
              const lastMessage = messageDb.getLastMessage.get(room.id);
              return { ...room, lastMessage };
            });
            targetSocket.emit('roomList', roomsWithLastMessage);
          }
        }
        successCount++;
      });

      socket.emit('adminActionSuccess', {
        message: `已将 ${successCount} 名非管理员用户从房间移除`
      });
      console.log(`🌐 Admin ${currentUser.username} made room ${roomId} invisible to all (${successCount} users)`);
    }

    // Reload admin panel data
    setTimeout(() => {
      socket.emit('reloadSpecialRooms');
    }, 500);
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentUser) {
      onlineUsers.delete(currentUser.id);

      // Notify other users of offline status
      io.emit('userOffline', {
        id: currentUser.id,
        username: currentUser.username
      });

      console.log(`❌ User offline: ${currentUser.username} (ID: ${currentUser.id})`);
    }

    console.log(`📱 Connection disconnected: ${socket.id}`);
  });
});

// HTTP API routes (for Bot or other clients)
app.post('/api/login', async (req, res) => {
  const { username, password, isBot } = req.body;

  // Validate required parameters
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password cannot be empty'
    });
  }

  const result = await authenticateUser(username, password, isBot);

  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Change password API
app.post('/api/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized, please login first'
    });
  }

  const { currentPassword, newPassword } = req.body;

  // Validate required parameters
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Please fill in all required fields'
    });
  }

  const result = await changePassword(user.id, currentPassword, newPassword);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.get('/api/rooms', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rooms = roomDb.getUserRooms.all(user.id);
  res.json(rooms);
});

app.get('/api/messages/:roomId', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { roomId } = req.params;
  const { limit = 50 } = req.query;

  const messages = messageDb.getByRoom.all(roomId, parseInt(limit));
  res.json(messages.reverse());
});

// Start server
const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log('\n========================================');
  console.log('🚀 Simple LAN Chat System Started');
  console.log('========================================');
  console.log(`\n📡 Local access: http://localhost:${PORT}`);
  console.log(`📡 LAN access: http://YOUR_IP:${PORT}`);
  console.log('\n💡 Tip: Use ipconfig (Windows) or ifconfig (Mac/Linux) to check IP address');
  console.log('\n========================================\n');
});
