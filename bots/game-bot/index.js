const io = require('socket.io-client');
const axios = require('axios');
const https = require('https');
const path = require('path');
require('dotenv').config();

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3030';
const BOT_USERNAME = path.basename(__dirname); // "game-bot"
const BOT_PASSWORD = process.env.BOT_PASSWORD;
const BOT_DISPLAY_NAME = '游戏大厅'; // Fixed display name
const REJECT_UNAUTHORIZED = process.env.REJECT_UNAUTHORIZED !== 'false';

async function main() {
  console.log('\n========================================');
  console.log('🎮 游戏大厅 Bot starting...');
  console.log('========================================\n');

  // Step 1: Login via HTTP API
  let token;
  try {
    const axiosConfig = {
      httpsAgent: new https.Agent({ rejectUnauthorized: REJECT_UNAUTHORIZED })
    };

    const loginResponse = await axios.post(
      `${SERVER_URL}/api/login`,
      { username: BOT_USERNAME, password: BOT_PASSWORD },
      axiosConfig
    );

    if (!loginResponse.data.success) {
      throw new Error(loginResponse.data.error || 'Login failed');
    }

    token = loginResponse.data.token;
    console.log('✅ Login successful');

  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }

  // Step 2: Connect via Socket.io
  const socket = io(SERVER_URL, {
    auth: { token },
    rejectUnauthorized: REJECT_UNAUTHORIZED
  });

  let currentUser = null;
  let myPrivateRooms = [];

  socket.on('connect', () => {
    console.log('🔌 Connected to server');
    socket.emit('loginWithToken', token);
  });

  socket.on('loginSuccess', (data) => {
    currentUser = data.user;
    console.log(`✅ Authenticated as: ${currentUser.displayName} (${currentUser.username})`);

    // Step 3: Update display name to "游戏大厅" if needed
    if (currentUser.displayName !== BOT_DISPLAY_NAME) {
      socket.emit('updateDisplayName', { displayName: BOT_DISPLAY_NAME });
    }

    // Step 4: Ensure private rooms exist with all users, then restore visibility
    socket.emit('botEnsureRoomsForAllUsers');
    socket.emit('botRestoreRooms');
  });

  socket.on('displayNameUpdated', (data) => {
    console.log(`✏️  Display name updated to: ${data.displayName}`);
  });

  socket.on('roomList', (rooms) => {
    // Track which private rooms belong to this bot
    myPrivateRooms = rooms.filter(r => r.type === 'private');
    console.log(`📁 Managing ${myPrivateRooms.length} private rooms`);
  });

  socket.on('newRoom', (room) => {
    // Track new private rooms
    if (room.type === 'private') {
      myPrivateRooms.push(room);
      console.log(`📁 New room created: ${room.name}`);
    }
  });

  // Note: No message handling - frontend displays game cards directly

  // Step 5: Handle shutdown - hide all rooms
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down...');
    socket.emit('botHideRooms');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for server to process
    socket.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    socket.emit('botHideRooms');
    socket.close();
    process.exit(0);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Disconnected from server');
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
}

main().catch(error => {
  console.error('❌ Bot startup failed:', error);
  process.exit(1);
});
