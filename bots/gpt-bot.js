const io = require('socket.io-client');
const axios = require('axios');
require('dotenv').config();

// 配置
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3030';
const BOT_USERNAME = process.env.BOT_USERNAME || 'gpt-bot';
const BOT_PASSWORD = process.env.BOT_PASSWORD;
const FOUNDRY_ENDPOINT = process.env.FOUNDRY_ENDPOINT;
const FOUNDRY_API_KEY = process.env.FOUNDRY_API_KEY;

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
    console.error('❌ GPT-4o 调用失败:', error.response?.data || error.message);
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

    const loginRes = await axios.post(`${SERVER_URL}/api/login`, {
      username: BOT_USERNAME,
      password: BOT_PASSWORD,
      isBot: true
    });

    if (!loginRes.data.success) {
      throw new Error(loginRes.data.error || '登录失败');
    }

    token = loginRes.data.token;
    console.log('✅ 登录成功！\n');

  } catch (error) {
    console.error('❌ 登录失败:', error.response?.data?.error || error.message);
    console.error('\n请检查:');
    console.error('  1. 服务器是否正在运行');
    console.error('  2. SERVER_URL 是否正确');
    console.error('  3. BOT_PASSWORD 是否正确');
    process.exit(1);
  }

  // 连接 Socket.io
  const socket = io(SERVER_URL, {
    auth: { token }
  });

  let currentUser = null;
  const processedMessages = new Set(); // 防止重复处理

  socket.on('connect', () => {
    console.log('✅ WebSocket 已连接\n');
    socket.emit('loginWithToken', { token });
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket 已断开连接');
  });

  socket.on('loginSuccess', (data) => {
    currentUser = data.user;
    console.log('========================================');
    console.log('🎉 Bot 已上线！');
    console.log('========================================');
    console.log(`\n📍 Bot ID: ${currentUser.id}`);
    console.log(`📍 用户名: ${currentUser.username}`);
    console.log(`\n💡 提示: 在聊天中使用 @${currentUser.username} 来提及我\n`);
    console.log('等待用户提及...\n');
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

    // 检查是否被提及
    const isMentioned = message.text.includes(`@${currentUser.username}`);

    if (!isMentioned) {
      return;
    }

    // 提取用户问题（移除 @ 提及）
    const userQuestion = message.text
      .replace(new RegExp(`@${currentUser.username}:?`, 'g'), '')
      .trim();

    if (!userQuestion) {
      socket.emit('sendMessage', {
        roomId: message.room_id,
        text: '你好！我是 GPT-4o 助手。使用 @' + currentUser.username + ' 问题 来提问吧！'
      });
      return;
    }

    console.log('========================================');
    console.log('📩 收到提及');
    console.log('========================================');
    console.log(`👤 用户: ${message.display_name || message.username}`);
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

  // 定期获取在线用户（保持活跃）
  setInterval(() => {
    socket.emit('getOnlineUsers');
  }, 60000);

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
