const io = require('socket.io-client');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

// 配置
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3030';
const BOT_USERNAME = process.env.BOT_USERNAME || 'gpt-bot';
const BOT_PASSWORD = process.env.BOT_PASSWORD;
const FOUNDRY_ENDPOINT = process.env.FOUNDRY_ENDPOINT;
const FOUNDRY_API_KEY = process.env.FOUNDRY_API_KEY;
const REJECT_UNAUTHORIZED = process.env.REJECT_UNAUTHORIZED !== 'false'; // 默认验证证书

// 如果禁用证书验证，显示警告
if (!REJECT_UNAUTHORIZED) {
  console.warn('⚠️  警告: 已禁用 SSL 证书验证（REJECT_UNAUTHORIZED=false）');
  console.warn('⚠️  这会降低安全性，仅用于开发/测试环境的自签名证书\n');
}

// 验证配置
if (!BOT_PASSWORD) {
  console.error('❌ 错误: 缺少 BOT_PASSWORD 环境变量');
  console.error('请在 .env 文件中设置: BOT_PASSWORD=your-password');
  process.exit(1);
}

if (!FOUNDRY_ENDPOINT || !FOUNDRY_API_KEY) {
  console.error('❌ 错误: 缺少 Foundry GPT-4o 配置');
  console.error('请在 .env 文件中设置:');
  console.error('  FOUNDRY_ENDPOINT=https://your-endpoint.azure.com/v1/chat/completions');
  console.error('  FOUNDRY_API_KEY=your-api-key');
  process.exit(1);
}

// 调用 GPT-4o
async function callGPT4o(userMessage) {
  try {
    const response = await axios.post(
      FOUNDRY_ENDPOINT,
      {
        messages: [
          {
            role: 'system',
            content: '你是一个友好的 AI 助手,在局域网聊天室中帮助用户回答问题。请用简洁、友好的方式回答。'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FOUNDRY_API_KEY}`
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    const errorData = error.response ? error.response.data : null;
    console.error('❌ GPT-4o 调用失败:', errorData || error.message);
    return '抱歉，我遇到了问题，暂时无法回答你的问题。';
  }
}

// 主函数
async function main() {
  console.log('\n========================================');
  console.log('🤖 GPT-4o Bot 启动中...');
  console.log('========================================\n');

  // 先通过 HTTP API 登录获取 token
  let token;
  try {
    console.log(`📡 正在登录服务器: ${SERVER_URL}`);
    console.log(`👤 Bot 用户名: ${BOT_USERNAME}\n`);

    // 配置 axios，允许忽略自签名证书
    const axiosConfig = {
      httpsAgent: new https.Agent({
        rejectUnauthorized: REJECT_UNAUTHORIZED
      })
    };

    const loginRes = await axios.post(`${SERVER_URL}/api/login`, {
      username: BOT_USERNAME,
      password: BOT_PASSWORD,
      isBot: true
    }, axiosConfig);

    if (!loginRes.data.success) {
      throw new Error(loginRes.data.error || '登录失败');
    }

    token = loginRes.data.token;
    console.log('✅ 登录成功！\n');

  } catch (error) {
    const errorMessage = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : error.message;
    console.error('❌ 登录失败:', errorMessage);
    console.error('\n请检查:');
    console.error('  1. 服务器是否正在运行');
    console.error('  2. SERVER_URL 是否正确');
    console.error('  3. BOT_PASSWORD 是否正确');
    process.exit(1);
  }

  // 连接 Socket.io
  const socket = io(SERVER_URL, {
    auth: { token },
    reconnection: true,           // 启用自动重连
    reconnectionDelay: 1000,      // 首次重连延迟 1 秒
    reconnectionDelayMax: 5000,   // 最大重连延迟 5 秒
    reconnectionAttempts: Infinity, // 无限重连
    timeout: 20000,               // 连接超时 20 秒
    rejectUnauthorized: REJECT_UNAUTHORIZED  // SSL 证书验证控制
  });

  let currentUser = null;
  const processedMessages = new Set(); // 防止重复处理
  const roomsMap = new Map(); // 存储房间信息 (roomId -> room)

  socket.on('connect', () => {
    console.log('✅ WebSocket 已连接\n');
    socket.emit('loginWithToken', { token });
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ WebSocket 已断开: ${reason}`);
    if (reason === 'io server disconnect') {
      // 服务端主动断开，尝试重连
      console.log('🔄 服务端断开连接，将自动重连...');
      socket.connect();
    }
  });

  socket.on('connect_error', (error) => {
    console.error('❌ 连接错误:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ 已重新连接 (尝试次数: ${attemptNumber})`);
    console.log('🔄 正在重新登录...');
    socket.emit('loginWithToken', { token });
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 正在尝试重连... (第 ${attemptNumber} 次)`);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ 重连失败:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ 重连失败：已达到最大尝试次数');
    process.exit(1);
  });

  socket.on('loginSuccess', (data) => {
    currentUser = data.user;
    console.log('========================================');
    console.log('🎉 Bot 已上线！');
    console.log('========================================');
    console.log(`\n📍 Bot ID: ${currentUser.id}`);
    console.log(`📍 用户名: ${currentUser.username}`);
    console.log(`\n💡 提示: 在聊天中使用 @${currentUser.username} 来提及我\n`);
    console.log('💡 私聊房间中可以直接对话，无需 @ 提及\n');
    console.log('等待用户消息...\n');
  });

  socket.on('roomList', (rooms) => {
    // 存储房间信息
    rooms.forEach(room => {
      roomsMap.set(room.id, room);
    });
    console.log(`📁 已加载 ${rooms.length} 个房间`);
  });

  socket.on('newRoom', (room) => {
    // 新房间创建时更新
    roomsMap.set(room.id, room);
    console.log(`📁 新房间: ${room.name} (${room.type})`);
  });

  socket.on('loginError', (data) => {
    console.error('❌ 登录失败:', data.message);
    process.exit(1);
  });

  socket.on('message', async (message) => {
    // 防止重复处理
    if (processedMessages.has(message.id)) {
      return;
    }
    processedMessages.add(message.id);

    // 清理旧的消息 ID（保留最近 1000 条）
    if (processedMessages.size > 1000) {
      const arr = Array.from(processedMessages);
      processedMessages.clear();
      arr.slice(-1000).forEach(id => processedMessages.add(id));
    }

    // 忽略自己的消息
    if (message.user_id === currentUser.id) {
      return;
    }

    // 获取房间信息
    const room = roomsMap.get(message.room_id);
    const isPrivateChat = room && room.type === 'private';

    // 检查是否被提及
    const isMentioned = message.text.includes(`@${currentUser.username}`);

    // 私聊房间：响应所有消息；群聊房间：只响应 @ 提及
    if (!isPrivateChat && !isMentioned) {
      return;
    }

    // 提取用户问题
    let userQuestion;
    if (isMentioned) {
      // 如果有 @ 提及，移除 @ 部分
      userQuestion = message.text
        .replace(new RegExp(`@${currentUser.username}:?`, 'g'), '')
        .trim();
    } else {
      // 私聊中没有 @ 提及，直接使用全部文本
      userQuestion = message.text.trim();
    }

    if (!userQuestion) {
      socket.emit('sendMessage', {
        roomId: message.room_id,
        text: '你好！我是 GPT-4o 助手。' + (isPrivateChat ? '私聊中可以直接提问！' : '使用 @' + currentUser.username + ' 问题 来提问吧！')
      });
      return;
    }

    console.log('========================================');
    console.log(`📩 收到消息 (${isPrivateChat ? '私聊' : '群聊'})`);
    console.log('========================================');
    console.log(`👤 用户: ${message.display_name || message.username}`);
    console.log(`🏠 房间: ${room ? room.name : message.room_id}`);
    console.log(`❓ 问题: ${userQuestion}`);
    console.log('');

    // 调用 GPT-4o
    console.log('🤔 正在思考...');
    const reply = await callGPT4o(userQuestion);

    console.log('💬 回复: ' + reply.substring(0, 100) + (reply.length > 100 ? '...' : ''));
    console.log('');

    // 发送回复
    socket.emit('sendMessage', {
      roomId: message.room_id,
      text: reply
    });
  });

  socket.on('error', (data) => {
    console.error('❌ 错误:', data.message);
  });

  // 心跳机制：定期发送 keepAlive 保持在线状态
  setInterval(() => {
    if (socket.connected && currentUser) {
      socket.emit('keepAlive');
      console.log('💓 发送心跳');
    }
  }, 30000); // 每 30 秒一次（服务端认为 5 分钟内活跃为在线）

  // 捕获退出信号
  process.on('SIGINT', () => {
    console.log('\n\n👋 Bot 正在退出...');
    socket.disconnect();
    process.exit(0);
  });
}

// 启动 Bot
main().catch(error => {
  console.error('\n❌ Bot 启动失败:', error);
  process.exit(1);
});
