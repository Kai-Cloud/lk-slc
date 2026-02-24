const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const { initDatabase, userDb, roomDb, messageDb, unreadDb, getOrCreatePrivateRoom } = require('./db');
const { authenticateUser, verifyToken, changePassword } = require('./auth');

// 初始化数据库
initDatabase();

// 创建 Express 应用
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 在线用户映射 { userId: socketId }
const onlineUsers = new Map();

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log(`📱 新连接: ${socket.id}`);

  let currentUser = null;

  // 登录事件
  socket.on('login', async (data) => {
    const { username, password } = data;

    if (!username || !password) {
      socket.emit('error', { message: '用户名和密码不能为空' });
      return;
    }

    const result = await authenticateUser(username, password);

    if (!result.success) {
      socket.emit('loginError', { message: result.error });
      return;
    }

    currentUser = result.user;
    socket.userId = currentUser.id;

    // 记录在线状态
    onlineUsers.set(currentUser.id, socket.id);

    // 更新最后在线时间
    userDb.updateLastSeen.run(currentUser.id);

    // 获取用户的所有房间
    const rooms = roomDb.getUserRooms.all(currentUser.id);

    // 加入所有房间（Socket.io 房间）
    rooms.forEach(room => {
      socket.join(room.id);
    });

    // 发送登录成功
    socket.emit('loginSuccess', {
      user: currentUser,
      token: result.token
    });

    // 发送房间列表
    const roomsWithLastMessage = rooms.map(room => {
      const lastMessage = messageDb.getLastMessage.get(room.id);
      return {
        ...room,
        lastMessage
      };
    });

    socket.emit('roomList', roomsWithLastMessage);

    // 通知其他用户上线
    io.emit('userOnline', {
      id: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName
    });

    console.log(`✅ 用户登录: ${currentUser.username} (ID: ${currentUser.id})`);
  });

  // Token 登录（自动登录）
  socket.on('loginWithToken', (data) => {
    const { token } = data;

    if (!token) {
      socket.emit('loginError', { message: '无效的令牌' });
      return;
    }

    const user = verifyToken(token);

    if (!user) {
      socket.emit('loginError', { message: '令牌已过期，请重新登录' });
      return;
    }

    currentUser = user;
    socket.userId = user.id;

    // 记录在线状态
    onlineUsers.set(user.id, socket.id);

    // 更新最后在线时间
    userDb.updateLastSeen.run(user.id);

    // 获取用户的所有房间
    const rooms = roomDb.getUserRooms.all(user.id);

    // 加入所有房间
    rooms.forEach(room => {
      socket.join(room.id);
    });

    // 发送登录成功
    socket.emit('loginSuccess', { user });

    // 加载未读计数
    const unreadCounts = unreadDb.getUserUnreadCounts.all(user.id);
    const unreadMap = {};
    unreadCounts.forEach(item => {
      unreadMap[item.room_id] = item.count;
    });

    // 发送房间列表（包含未读计数）
    const roomsWithLastMessage = rooms.map(room => {
      const lastMessage = messageDb.getLastMessage.get(room.id);
      return {
        ...room,
        lastMessage,
        unreadCount: unreadMap[room.id] || 0
      };
    });

    socket.emit('roomList', roomsWithLastMessage);

    // 发送总未读数
    const totalUnread = unreadDb.getTotalUnreadCount.get(user.id);
    socket.emit('totalUnreadCount', { total: totalUnread?.total || 0 });

    // 通知其他用户上线
    io.emit('userOnline', {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    });

    console.log(`✅ 用户自动登录: ${user.username} (ID: ${user.id})`);
  });

  // 加载房间消息
  socket.on('loadMessages', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: '请先登录' });
      return;
    }

    const { roomId, limit = 50, before, skipClearUnread } = data;

    // 只有在不跳过清除未读时才清除（默认清除）
    if (!skipClearUnread) {
      unreadDb.clearUnreadCount.run(currentUser.id, roomId);

      // 通知客户端未读计数已清除
      socket.emit('unreadCountUpdate', { roomId, count: 0 });

      // 更新总未读数
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
      messages: messages.reverse() // 按时间正序
    });
  });

  // 清除未读计数（用户交互时触发）
  socket.on('clearUnread', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: '请先登录' });
      return;
    }

    const { roomId } = data;

    // 清除该房间的未读计数
    unreadDb.clearUnreadCount.run(currentUser.id, roomId);

    // 通知客户端未读计数已清除
    socket.emit('unreadCountUpdate', { roomId, count: 0 });

    // 更新总未读数
    const totalUnread = unreadDb.getTotalUnreadCount.get(currentUser.id);
    socket.emit('totalUnreadCount', { total: totalUnread?.total || 0 });

    console.log(`🔔 用户 ${currentUser.username} 清除了房间 ${roomId} 的未读计数`);
  });

  // 发送消息
  socket.on('sendMessage', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: '请先登录' });
      return;
    }

    const { roomId, text } = data;

    if (!text || text.trim() === '') {
      return;
    }

    // 更新用户在线时间
    userDb.updateLastSeen.run(currentUser.id);

    // 检查用户是否在房间中
    const room = roomDb.findById.get(roomId);
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    // 保存消息到数据库
    const result = messageDb.create.run(roomId, currentUser.id, text.trim());
    const messageId = result.lastInsertRowid;

    // 构建消息对象
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

    // 广播到房间
    io.to(roomId).emit('message', message);

    // 获取当前房间成员
    const members = roomDb.getMembers.all(roomId);
    const memberIds = new Set(members.map(m => m.id));

    // 如果是私聊房间，检查是否需要重新添加已删除的成员
    if (room.type === 'private') {
      const match = roomId.match(/^private_(\d+)_(\d+)$/);
      if (match) {
        const [_, id1Str, id2Str] = match;
        const expectedUserIds = [parseInt(id1Str), parseInt(id2Str)];

        // 找出应该在房间但不在成员列表中的用户（说明被删除了）
        expectedUserIds.forEach(userId => {
          if (!memberIds.has(userId) && userId !== currentUser.id) {
            // 重新添加成员
            roomDb.addMember.run(roomId, userId);
            console.log(`🔄 自动重新添加用户 ${userId} 到私聊房间 ${roomId}`);

            // 增加未读计数
            unreadDb.incrementUnreadCount.run(userId, roomId, messageId);

            // 如果用户在线，推送新房间和未读计数通知
            const targetSocketId = onlineUsers.get(userId);
            if (targetSocketId) {
              const targetSocket = io.sockets.sockets.get(targetSocketId);
              if (targetSocket) {
                targetSocket.join(roomId);
              }

              // 重新获取完整的房间信息（包含更新后的成员列表）
              const updatedRoom = roomDb.findById.get(roomId);
              const roomWithDetails = {
                ...updatedRoom,
                members: roomDb.getMembers.all(roomId),
                lastMessage: message,
                unreadCount: 1
              };

              // 推送新房间通知
              io.to(targetSocketId).emit('newRoom', roomWithDetails);

              // 推送未读计数
              io.to(targetSocketId).emit('unreadCountUpdate', {
                roomId: roomId,
                count: 1
              });

              // 推送总未读数
              const totalUnread = unreadDb.getTotalUnreadCount.get(userId);
              io.to(targetSocketId).emit('totalUnreadCount', {
                total: totalUnread?.total || 0
              });

              console.log(`📩 已通知用户 ${userId} 新的私聊消息`);
            }
          }
        });
      }
    }

    // 为现有成员增加未读计数（排除发送者和刚重新添加的成员）
    members.forEach(member => {
      if (member.id !== currentUser.id) {
        // 增加未读计数
        unreadDb.incrementUnreadCount.run(member.id, roomId, messageId);

        // 如果用户在线，推送未读计数更新
        const targetSocketId = onlineUsers.get(member.id);
        if (targetSocketId) {
          // 查询最新的未读计数
          const unreadResult = unreadDb.getRoomUnreadCount.get(member.id, roomId);
          const newCount = unreadResult ? unreadResult.count : 1;

          io.to(targetSocketId).emit('unreadCountUpdate', {
            roomId: roomId,
            count: newCount
          });

          // 同时推送总未读数更新
          const totalUnread = unreadDb.getTotalUnreadCount.get(member.id);
          io.to(targetSocketId).emit('totalUnreadCount', {
            total: totalUnread?.total || 0
          });
        }
      }
    });

    // 广播在线用户更新（因为 last_seen 改变了）
    io.emit('userStatusUpdate', {
      id: currentUser.id,
      username: currentUser.username,
      lastSeen: new Date().toISOString()
    });

    console.log(`💬 [${room.name}] ${currentUser.username}: ${text.substring(0, 50)}...`);
  });

  // 创建私聊
  socket.on('createPrivateChat', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: '请先登录' });
      return;
    }

    const { targetUserId } = data;

    if (targetUserId === currentUser.id) {
      socket.emit('error', { message: '不能与自己私聊' });
      return;
    }

    // 创建或获取私聊房间
    const room = getOrCreatePrivateRoom(currentUser.id, targetUserId);

    // 加入房间
    socket.join(room.id);

    // 如果对方在线，让对方也加入
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.join(room.id);
      }
      // 通知对方有新房间
      io.to(targetSocketId).emit('newRoom', room);
    }

    // 返回房间信息
    socket.emit('roomCreated', room);

    console.log(`🔒 私聊创建: ${currentUser.username} <-> User#${targetUserId}`);
  });

  // 获取在线用户列表
  socket.on('getOnlineUsers', () => {
    const users = userDb.getOnline.all();
    socket.emit('onlineUsers', users);
  });

  // 搜索消息
  socket.on('searchMessages', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: '请先登录' });
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

  // 心跳保活
  socket.on('keepAlive', () => {
    if (currentUser) {
      userDb.updateLastSeen.run(currentUser.id);
    }
  });

  // 删除房间
  socket.on('deleteRoom', (data) => {
    if (!currentUser) {
      socket.emit('error', { message: '请先登录' });
      return;
    }

    const { roomId } = data;

    // 不能删除大厅
    if (roomId === 'lobby') {
      socket.emit('error', { message: '不能删除大厅' });
      return;
    }

    // 检查房间是否存在
    const room = roomDb.findById.get(roomId);
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    // 从房间中移除当前用户
    roomDb.removeMember.run(roomId, currentUser.id);

    // 离开 Socket.io 房间
    socket.leave(roomId);

    // 通知当前用户删除成功
    socket.emit('roomDeleted', { roomId });

    // 私聊房间：只移除成员关系，不删除房间本身（保留历史消息）
    if (room.type === 'private') {
      console.log(`👋 用户 ${currentUser.username} 删除了私聊房间 ${roomId}（房间保留，可通过消息重新激活）`);
    } else {
      // 群聊房间：检查是否还有其他成员
      const remainingMembers = roomDb.getRoomMembers.all(roomId);

      // 如果群聊房间没有成员了，删除房间
      if (remainingMembers.length === 0) {
        roomDb.delete.run(roomId);
        console.log(`🗑️ 群聊房间已删除: ${room.name} (ID: ${roomId})`);
      } else {
        console.log(`👋 用户 ${currentUser.username} 离开群聊房间: ${room.name}`);
      }
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    if (currentUser) {
      onlineUsers.delete(currentUser.id);

      // 通知其他用户下线
      io.emit('userOffline', {
        id: currentUser.id,
        username: currentUser.username
      });

      console.log(`❌ 用户离线: ${currentUser.username} (ID: ${currentUser.id})`);
    }

    console.log(`📱 连接断开: ${socket.id}`);
  });
});

// HTTP API 路由（用于 Bot 或其他客户端）
app.post('/api/login', async (req, res) => {
  const { username, password, isBot } = req.body;

  // 验证必填参数
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: '用户名和密码不能为空'
    });
  }

  const result = await authenticateUser(username, password, isBot);

  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// 修改密码 API
app.post('/api/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: '未授权，请先登录'
    });
  }

  const { currentPassword, newPassword } = req.body;

  // 验证必填参数
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: '请填写完整信息'
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
    return res.status(401).json({ error: '未授权' });
  }

  const rooms = roomDb.getUserRooms.all(user.id);
  res.json(rooms);
});

app.get('/api/messages/:roomId', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: '未授权' });
  }

  const { roomId } = req.params;
  const { limit = 50 } = req.query;

  const messages = messageDb.getByRoom.all(roomId, parseInt(limit));
  res.json(messages.reverse());
});

// 启动服务器
const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log('\n========================================');
  console.log('🚀 简单局域网聊天系统已启动');
  console.log('========================================');
  console.log(`\n📡 本地访问: http://localhost:${PORT}`);
  console.log(`📡 局域网访问: http://YOUR_IP:${PORT}`);
  console.log('\n💡 提示: 使用 ipconfig (Windows) 或 ifconfig (Mac/Linux) 查看 IP 地址');
  console.log('\n========================================\n');
});
