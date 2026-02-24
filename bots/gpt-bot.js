const io = require('socket.io-client');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3030';
const BOT_USERNAME = process.env.BOT_USERNAME || 'gpt-bot';
const BOT_PASSWORD = process.env.BOT_PASSWORD;
const FOUNDRY_ENDPOINT = process.env.FOUNDRY_ENDPOINT;
const FOUNDRY_API_KEY = process.env.FOUNDRY_API_KEY;
const REJECT_UNAUTHORIZED = process.env.REJECT_UNAUTHORIZED !== 'false'; // Default: verify certificates

// If certificate verification is disabled, show warning
if (!REJECT_UNAUTHORIZED) {
  console.warn('⚠️  Warning: SSL certificate verification disabled (REJECT_UNAUTHORIZED=false)');
  console.warn('⚠️  This reduces security, only use for development/testing with self-signed certificates\n');
}

// Validate configuration
if (!BOT_PASSWORD) {
  console.error('❌ Error: Missing BOT_PASSWORD environment variable');
  console.error('Please set in .env file: BOT_PASSWORD=your-password');
  process.exit(1);
}

if (!FOUNDRY_ENDPOINT || !FOUNDRY_API_KEY) {
  console.error('❌ Error: Missing Foundry GPT-4o configuration');
  console.error('Please set in .env file:');
  console.error('  FOUNDRY_ENDPOINT=https://your-endpoint.azure.com/v1/chat/completions');
  console.error('  FOUNDRY_API_KEY=your-api-key');
  process.exit(1);
}

// Call GPT-4o
async function callGPT4o(userMessage) {
  try {
    const response = await axios.post(
      FOUNDRY_ENDPOINT,
      {
        messages: [
          {
            role: 'system',
            content: 'You are a friendly AI assistant helping users answer questions in a LAN chat room. Please respond in a concise and friendly manner.'
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
    console.error('❌ GPT-4o call failed:', errorData || error.message);
    return 'Sorry, I encountered an issue and cannot answer your question at the moment.';
  }
}

// Main function
async function main() {
  console.log('\n========================================');
  console.log('🤖 GPT-4o Bot starting...');
  console.log('========================================\n');

  // First login via HTTP API to get token
  let token;
  try {
    console.log(`📡 Logging in to server: ${SERVER_URL}`);
    console.log(`👤 Bot username: ${BOT_USERNAME}\n`);

    // Configure axios to allow ignoring self-signed certificates
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
      throw new Error(loginRes.data.error || 'Login failed');
    }

    token = loginRes.data.token;
    console.log('✅ Login successful!\n');

  } catch (error) {
    const errorMessage = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : error.message;
    console.error('❌ Login failed:', errorMessage);
    console.error('\nPlease check:');
    console.error('  1. Server is running');
    console.error('  2. SERVER_URL is correct');
    console.error('  3. BOT_PASSWORD is correct');
    process.exit(1);
  }

  // Connect Socket.io
  const socket = io(SERVER_URL, {
    auth: { token },
    reconnection: true,           // Enable auto-reconnect
    reconnectionDelay: 1000,      // First reconnect delay: 1 second
    reconnectionDelayMax: 5000,   // Max reconnect delay: 5 seconds
    reconnectionAttempts: Infinity, // Infinite reconnect attempts
    timeout: 20000,               // Connection timeout: 20 seconds
    rejectUnauthorized: REJECT_UNAUTHORIZED  // SSL certificate verification control
  });

  let currentUser = null;
  const processedMessages = new Set(); // Prevent duplicate processing
  const roomsMap = new Map(); // Store room info (roomId -> room)

  socket.on('connect', () => {
    console.log('✅ WebSocket connected\n');
    socket.emit('loginWithToken', { token });
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ WebSocket disconnected: ${reason}`);
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, attempt reconnect
      console.log('🔄 Server disconnected, will auto-reconnect...');
      socket.connect();
    }
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ Reconnected (attempts: ${attemptNumber})`);
    console.log('🔄 Re-logging in...');
    socket.emit('loginWithToken', { token });
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Attempting to reconnect... (attempt ${attemptNumber})`);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Reconnect failed:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Reconnect failed: Max attempts reached');
    process.exit(1);
  });

  socket.on('loginSuccess', (data) => {
    currentUser = data.user;
    console.log('========================================');
    console.log('🎉 Bot is online!');
    console.log('========================================');
    console.log(`\n📍 Bot ID: ${currentUser.id}`);
    console.log(`📍 Username: ${currentUser.username}`);
    console.log(`\n💡 Tip: Use @${currentUser.username} to mention me in chat\n`);
    console.log('💡 In private rooms, you can chat directly without @ mention\n');
    console.log('Waiting for user messages...\n');
  });

  socket.on('roomList', (rooms) => {
    // Store room info
    rooms.forEach(room => {
      roomsMap.set(room.id, room);
    });
    console.log(`📁 Loaded ${rooms.length} rooms`);
  });

  socket.on('newRoom', (room) => {
    // Update on new room creation
    roomsMap.set(room.id, room);
    console.log(`📁 New room: ${room.name} (${room.type})`);
  });

  socket.on('loginError', (data) => {
    console.error('❌ Login failed:', data.message);
    process.exit(1);
  });

  socket.on('message', async (message) => {
    // Prevent duplicate processing
    if (processedMessages.has(message.id)) {
      return;
    }
    processedMessages.add(message.id);

    // Clean up old message IDs (keep most recent 1000)
    if (processedMessages.size > 1000) {
      const arr = Array.from(processedMessages);
      processedMessages.clear();
      arr.slice(-1000).forEach(id => processedMessages.add(id));
    }

    // Ignore own messages
    if (message.user_id === currentUser.id) {
      return;
    }

    // Get room info
    const room = roomsMap.get(message.room_id);
    const isPrivateChat = room && room.type === 'private';

    // Check if bot is mentioned
    const isMentioned = message.text.includes(`@${currentUser.username}`);

    // Private room: respond to all messages; Group room: only respond to @ mentions
    if (!isPrivateChat && !isMentioned) {
      return;
    }

    // Extract user question
    let userQuestion;
    if (isMentioned) {
      // If @ mentioned, remove @ part
      userQuestion = message.text
        .replace(new RegExp(`@${currentUser.username}:?`, 'g'), '')
        .trim();
    } else {
      // In private chat without @ mention, use full text
      userQuestion = message.text.trim();
    }

    if (!userQuestion) {
      socket.emit('sendMessage', {
        roomId: message.room_id,
        text: 'Hello! I am GPT-4o assistant. ' + (isPrivateChat ? 'You can ask questions directly in private chat!' : 'Use @' + currentUser.username + ' question to ask!')
      });
      return;
    }

    console.log('========================================');
    console.log(`📩 Received message (${isPrivateChat ? 'private chat' : 'group chat'})`);
    console.log('========================================');
    console.log(`👤 User: ${message.display_name || message.username}`);
    console.log(`🏠 Room: ${room ? room.name : message.room_id}`);
    console.log(`❓ Question: ${userQuestion}`);
    console.log('');

    // Call GPT-4o
    console.log('🤔 Thinking...');
    const reply = await callGPT4o(userQuestion);

    console.log('💬 Reply: ' + reply.substring(0, 100) + (reply.length > 100 ? '...' : ''));
    console.log('');

    // Send reply
    socket.emit('sendMessage', {
      roomId: message.room_id,
      text: reply
    });
  });

  socket.on('error', (data) => {
    console.error('❌ Error:', data.message);
  });

  // Heartbeat mechanism: Periodically send keepAlive to maintain online status
  setInterval(() => {
    if (socket.connected && currentUser) {
      socket.emit('keepAlive');
      console.log('💓 Sending heartbeat');
    }
  }, 30000); // Every 30 seconds (server considers activity within 5 minutes as online)

  // Capture exit signals
  process.on('SIGINT', () => {
    console.log('\n\n👋 Bot exiting...');
    socket.disconnect();
    process.exit(0);
  });
}

// Start Bot
main().catch(error => {
  console.error('\n❌ Bot startup failed:', error);
  process.exit(1);
});
