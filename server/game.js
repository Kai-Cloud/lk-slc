const path = require('path');
const fs = require('fs');
const { db, gameDb, userDb, roomDb, getOrCreatePrivateRoom } = require('./db');

/**
 * Set up /games/* static route serving lk-sgl game files.
 */
function setupGameRoutes(app) {
  const express = require('express');
  const LK_SGL_PATH = path.join(__dirname, '..', '..', 'lk-sgl');

  if (!fs.existsSync(LK_SGL_PATH)) {
    console.warn('\n⚠️  WARNING: lk-sgl project not found!');
    console.warn('   Expected location:', LK_SGL_PATH);
    console.warn('   Games will not be available.');
    console.warn('   Please ensure lk-sgl is in the same parent directory as simple-lan-chat.\n');
  } else {
    console.log('✅ lk-sgl project found at:', LK_SGL_PATH);

    app.use('/games', express.static(LK_SGL_PATH, {
      setHeaders: (res) => {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      }
    }));

    console.log('🎮 Games available at: /games/*\n');
  }
}

/**
 * Register game-related socket events on a connection.
 * @param {object} socket - socket.io socket
 * @param {function} getCurrentUser - returns currentUser for this connection
 */
function registerGameEvents(socket, getCurrentUser) {

  // Game progress: Load game progress for current user
  socket.on('getGameProgress', (data) => {
    const currentUser = getCurrentUser();
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
    const currentUser = getCurrentUser();
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
}

/**
 * Register bot-related socket events on a connection.
 * @param {object} socket - socket.io socket
 * @param {object} io - socket.io server instance
 * @param {function} getCurrentUser - returns currentUser for this connection
 */
function registerBotEvents(socket, io, getCurrentUser) {

  // Bot: Update display name
  socket.on('updateDisplayName', (data) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { displayName } = data;

    const displayNameRegex = /^[\w\-\u4E00-\u9FFF]{1,20}$/;
    if (!displayNameRegex.test(displayName)) {
      socket.emit('error', { message: 'Invalid display name format' });
      return;
    }

    try {
      userDb.updateDisplayName.run(displayName, currentUser.id);
      currentUser.displayName = displayName;

      socket.emit('displayNameUpdated', { displayName });
      console.log(`✏️  User ${currentUser.username} changed display name to: ${displayName}`);
    } catch (error) {
      console.error('❌ Failed to update display name:', error);
      socket.emit('error', { message: 'Failed to update display name' });
    }
  });

  // Bot: Set metadata (content_url, room_theme, avatar)
  socket.on('botSetMetadata', (data) => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isBot) {
      return;
    }

    try {
      const { content_url, room_theme, avatar } = data;
      userDb.updateBotMetadata.run(content_url || null, room_theme || null, avatar || null, currentUser.id);
      console.log(`Bot ${currentUser.username} set metadata: content_url=${content_url}, room_theme=${room_theme}, avatar=${avatar ? 'set' : 'none'}`);

      io.emit('roomListChanged');
    } catch (error) {
      console.error('❌ Failed to set bot metadata:', error);
      socket.emit('error', { message: 'Failed to set bot metadata' });
    }
  });

  // Bot: Restore room visibility on startup
  socket.on('botRestoreRooms', () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isBot) {
      return;
    }

    try {
      const myRooms = roomDb.getRoomsByBotUser.all(currentUser.id);

      let restoredCount = 0;
      myRooms.forEach(room => {
        if (room.is_active === -1) {
          roomDb.setRoomActive.run(1, room.id);
          restoredCount++;
        }
      });

      console.log(`🎮 Bot ${currentUser.username} restored ${restoredCount}/${myRooms.length} rooms`);
      io.emit('roomListChanged');

    } catch (error) {
      console.error('❌ Failed to restore bot rooms:', error);
    }
  });

  // Bot: Ensure private rooms exist with all non-bot users
  socket.on('botEnsureRoomsForAllUsers', () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isBot) {
      return;
    }

    try {
      const allUsers = userDb.getAll.all();
      const nonBotUsers = allUsers.filter(u => u.is_bot === 0);
      let created = 0;

      nonBotUsers.forEach(user => {
        const room = getOrCreatePrivateRoom(currentUser.id, user.id);
        if (room.is_active === null || room.is_active === undefined) {
          roomDb.setRoomActive.run(1, room.id);
        }
        created++;
      });

      console.log(`🎮 Bot ${currentUser.username} ensured private rooms for ${created} users`);
      io.emit('roomListChanged');

    } catch (error) {
      console.error('❌ Failed to ensure bot rooms:', error);
    }
  });

  // Bot: Hide rooms on shutdown
  socket.on('botHideRooms', () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isBot) {
      return;
    }

    try {
      const myRooms = roomDb.getRoomsByBotUser.all(currentUser.id);
      let hiddenCount = 0;

      myRooms.forEach(room => {
        if (room.is_active === 1 || room.is_active === null) {
          roomDb.setRoomActive.run(-1, room.id);
          hiddenCount++;
        }
      });

      console.log(`🎮 Bot ${currentUser.username} hid ${hiddenCount}/${myRooms.length} rooms`);
      io.emit('roomListChanged');

    } catch (error) {
      console.error('❌ Failed to hide bot rooms:', error);
    }
  });
}

/**
 * Handle bot disconnect: auto-hide active rooms.
 * Called from the main disconnect handler when currentUser.isBot is true.
 * @param {object} currentUser
 * @param {object} io - socket.io server instance
 */
function handleBotDisconnect(currentUser, io) {
  try {
    const myRooms = roomDb.getRoomsByBotUser.all(currentUser.id);
    let hiddenCount = 0;
    myRooms.forEach(room => {
      if (room.is_active === 1 || room.is_active === null) {
        roomDb.setRoomActive.run(-1, room.id);
        hiddenCount++;
      }
    });
    console.log(`🎮 Bot ${currentUser.username} disconnected, auto-hid ${hiddenCount}/${myRooms.length} rooms`);
    io.emit('roomListChanged');
  } catch (error) {
    console.error('❌ Failed to hide bot rooms on disconnect:', error);
  }
}

/**
 * Delete game data for a user (used by admin delete user).
 * @param {number} userId
 */
function deleteUserGameData(userId) {
  db.prepare('DELETE FROM game_progress WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM game_unlocks WHERE user_id = ?').run(userId);
}

module.exports = {
  setupGameRoutes,
  registerGameEvents,
  registerBotEvents,
  handleBotDisconnect,
  deleteUserGameData
};
