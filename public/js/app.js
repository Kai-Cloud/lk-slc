// Global variables
let socket = null;
let currentUser = null;
let currentRoom = null;
let rooms = [];
let onlineUsers = [];
let unreadCounts = {};  // Unread count mapping { roomId: count }
let totalUnreadCount = 0;  // Total unread count

// Translate page elements
function translatePage() {
  // Set document language
  document.documentElement.lang = i18n.currentLang === 'zh-CN' ? 'zh' : 'en';

  // Update title
  document.title = i18n.t('chat.title');

  // Translate elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = i18n.t(el.dataset.i18n);
  });

  // Translate placeholders
  document.querySelectorAll('[placeholder-i18n]').forEach(el => {
    el.placeholder = i18n.t(el.getAttribute('placeholder-i18n'));
  });

  // Translate title attributes
  document.querySelectorAll('[title-i18n]').forEach(el => {
    el.title = i18n.t(el.getAttribute('title-i18n'));
  });
}

// Listen for language changes
window.addEventListener('languageChange', () => {
  translatePage();
  // Re-render dynamic content
  renderRoomList();
  renderOnlineUsers();
  if (currentRoom) {
    updateConnectionStatus('connected');
  }
});

// Initial translation
translatePage();

// DOM 元素
const messageList = document.getElementById('messageList');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const roomList = document.getElementById('roomList');
const userList = document.getElementById('userList');
const currentUserName = document.getElementById('currentUserName');
const currentRoomName = document.getElementById('currentRoomName');
const roomSubtitle = document.getElementById('roomSubtitle');
const inputArea = document.getElementById('inputArea');
const connectionStatus = document.getElementById('connectionStatus');
const searchBtn = document.getElementById('searchBtn');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const closeSearch = document.getElementById('closeSearch');
const searchResults = document.getElementById('searchResults');
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const settingsBtn = document.getElementById('settingsBtn');
const changePasswordModal = document.getElementById('changePasswordModal');
const closePasswordModal = document.getElementById('closePasswordModal');
const cancelPasswordChange = document.getElementById('cancelPasswordChange');
const confirmPasswordChange = document.getElementById('confirmPasswordChange');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordError = document.getElementById('passwordError');

// 检查登录状态
const token = localStorage.getItem('chatToken');
const savedUser = localStorage.getItem('chatUser');

if (!token || !savedUser) {
  window.location.href = '/index.html';
} else {
  currentUser = JSON.parse(savedUser);
  initChat();
}

// 初始化聊天
function initChat() {
  // 显示当前用户
  currentUserName.textContent = currentUser.displayName || currentUser.username;

  // 连接 Socket.io
  connectSocket();

  // 绑定事件
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', handleMessageInputKeydown);
  messageInput.addEventListener('input', handleMessageInput);

  // 清除未读：当用户聚焦输入框时
  messageInput.addEventListener('focus', clearCurrentRoomUnread);

  // 清除未读：当用户点击消息列表时
  messageList.addEventListener('click', clearCurrentRoomUnread);

  searchBtn.addEventListener('click', () => {
    searchBar.classList.toggle('hidden');
    if (!searchBar.classList.contains('hidden')) {
      searchInput.focus();
    } else {
      searchResults.classList.add('hidden');
    }
  });
  closeSearch.addEventListener('click', () => {
    searchBar.classList.add('hidden');
    searchResults.classList.add('hidden');
    searchInput.value = '';
  });
  searchInput.addEventListener('input', debounce(handleSearch, 500));
  document.getElementById('refreshUsers').addEventListener('click', () => {
    socket.emit('getOnlineUsers');
  });
  toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('show');
  });
  logoutBtn.addEventListener('click', logout);
  settingsBtn.addEventListener('click', showChangePasswordModal);
  closePasswordModal.addEventListener('click', hideChangePasswordModal);
  cancelPasswordChange.addEventListener('click', hideChangePasswordModal);
  confirmPasswordChange.addEventListener('click', handleChangePassword);

  // 自动调整输入框高度
  messageInput.addEventListener('input', autoResizeTextarea);

  // 移动端：点击侧边栏外部区域时收起侧边栏
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('show')) {
      // 如果点击的不是侧边栏内部，也不是菜单按钮
      if (!sidebar.contains(e.target) && !toggleSidebar.contains(e.target)) {
        sidebar.classList.remove('show');
      }
    }
  });
}

// 连接 Socket.io
function connectSocket() {
  // 自动使用当前页面的协议和主机（HTTPS → WSS, HTTP → WS）
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],  // 优先 WebSocket
    secure: window.location.protocol === 'https:',  // HTTPS 时启用安全模式
    rejectUnauthorized: true  // 验证证书（生产环境推荐）
  });

  socket.on('connect', () => {
    console.log('✅ Socket.io connected');
    console.log(`🔗 Protocol: ${window.location.protocol}, Transport: ${socket.io.engine.transport.name}`);
    updateConnectionStatus('connected');

    // Login with token
    socket.emit('loginWithToken', { token });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket.io disconnected');
    updateConnectionStatus('disconnected');
  });

  socket.on('loginSuccess', (data) => {
    console.log('✅ Login successful:', data.user);
    currentUser = data.user;
  });

  socket.on('loginError', (data) => {
    console.error('❌ Login failed:', data.message);
    alert(i18n.t('error.loginFailed') + ': ' + data.message);
    logout();
  });

  socket.on('roomList', (data) => {
    rooms = data;

    // Initialize unread count mapping
    unreadCounts = {};
    data.forEach(room => {
      if (room.unreadCount) {
        unreadCounts[room.id] = room.unreadCount;
      }
    });

    renderRoomList();

    // Auto-select first room (lobby)
    if (rooms.length > 0 && !currentRoom) {
      selectRoom(rooms[0]);
    }
  });

  socket.on('message', (message) => {
    if (message.room_id === currentRoom?.id) {
      appendMessage(message);
    }

    // 更新房间预览
    updateRoomPreview(message.room_id, message.text, message.username, message.display_name);
  });

  socket.on('messages', (data) => {
    if (data.roomId === currentRoom?.id) {
      messageList.innerHTML = '';
      data.messages.forEach(msg => appendMessage(msg));
      scrollToBottom();
    }
  });

  socket.on('userOnline', (user) => {
    console.log('👤 User online:', user.username);
    socket.emit('getOnlineUsers');
  });

  socket.on('userOffline', (user) => {
    console.log('👤 User offline:', user.username);
    socket.emit('getOnlineUsers');
  });

  socket.on('onlineUsers', (users) => {
    onlineUsers = users;
    renderUserList();
  });

  socket.on('userStatusUpdate', (data) => {
    // Update user's last_seen time
    const user = onlineUsers.find(u => u.id === data.id);
    if (user) {
      user.last_seen = data.lastSeen;
      renderUserList();
    }
  });

  socket.on('roomCreated', (room) => {
    // Check if room already exists
    const existingRoomIndex = rooms.findIndex(r => r.id === room.id);
    if (existingRoomIndex !== -1) {
      // Update existing room
      rooms[existingRoomIndex] = room;
    } else {
      // Add new room
      rooms.push(room);
    }
    renderRoomList();
    selectRoom(room);
  });

  socket.on('newRoom', (room) => {
    rooms.push(room);
    renderRoomList();
  });

  socket.on('roomDeleted', (data) => {
    const { roomId } = data;
    // 从房间列表中移除
    rooms = rooms.filter(r => r.id !== roomId);
    renderRoomList();

    // 如果删除的是当前房间,切换到大厅
    if (currentRoom?.id === roomId) {
      const lobby = rooms.find(r => r.id === 'lobby');
      if (lobby) selectRoom(lobby);
    }
  });

  socket.on('searchResults', (results) => {
    renderSearchResults(results);
  });

  socket.on('error', (data) => {
    alert(i18n.t('error.connectionError') + ': ' + data.message);
  });

  // Receive unread count updates
  socket.on('unreadCountUpdate', (data) => {
    const { roomId, count } = data;

    console.log(`[Unread count update] Room: ${roomId}, New count: ${count}`);

    // Update unread count
    if (count === 0) {
      delete unreadCounts[roomId];
    } else {
      unreadCounts[roomId] = count;
    }

    // Re-render room list
    renderRoomList();

    // Recalculate total unread count
    totalUnreadCount = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
    updatePageTitle();
  });

  // Receive total unread count update
  socket.on('totalUnreadCount', (data) => {
    totalUnreadCount = data.total;
    updatePageTitle();
  });

  // Request online users
  setTimeout(() => {
    socket.emit('getOnlineUsers');
  }, 1000);
}

// Update page title
function updatePageTitle() {
  const baseTitle = i18n.t('chat.title');
  if (totalUnreadCount > 0) {
    document.title = `(${totalUnreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}

// 渲染房间列表
function renderRoomList() {
  roomList.innerHTML = rooms.map(room => {
    const isActive = room.id === currentRoom?.id;
    const unreadCount = unreadCounts[room.id] || 0;
    const hasUnread = unreadCount > 0;
    const isPinned = room.pinned === 1;
    const isLobby = room.id === 'lobby';

    // 获取房间显示名称
    let displayName = room.name;
    if (room.type === 'private' && room.members) {
      const otherMember = room.members.find(m => m.id !== currentUser?.id);
      if (otherMember) {
        displayName = otherMember.display_name || otherMember.username;
      }
    }

    // 置顶图标
    const pinIcon = isPinned ? '<span class="pin-icon" title="已置顶">📌</span>' : '';

    // Pin button (lobby doesn't show, as it's always pinned)
    let actionButtons = '';
    if (room.id !== 'lobby') {
      const pinButton = isPinned
        ? `<button class="room-pin-btn" title="${i18n.t('room.unpin')}">📌</button>`
        : `<button class="room-pin-btn unpinned" title="${i18n.t('room.pin')}">📍</button>`;
      actionButtons = `${pinButton}<button class="room-delete-btn" title="${i18n.t('room.delete')}">🗑️</button>`;
    }

    return `
      <div class="room-item ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''} ${isLobby ? 'lobby-room' : ''}" data-room-id="${room.id}">
        <div class="room-item-content">
          <div class="room-item-title">${pinIcon}${escapeHtml(displayName)}</div>
          <div class="room-item-preview" id="room-preview-${room.id}">
            ${room.lastMessage ? escapeHtml(room.lastMessage.text.substring(0, 30)) : i18n.t('room.startChat')}
          </div>
        </div>
        ${hasUnread ? `<div class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
        ${actionButtons}
      </div>
    `;
  }).join('');

  // 绑定点击事件
  document.querySelectorAll('.room-item').forEach(item => {
    const roomId = item.dataset.roomId;

    // 房间选择事件
    const contentArea = item.querySelector('.room-item-content');
    if (contentArea) {
      contentArea.addEventListener('click', () => {
        const room = rooms.find(r => r.id === roomId);
        if (room) selectRoom(room);
      });
    } else {
      // 没有 content 区域时（大厅）,整个区域可点击
      item.addEventListener('click', () => {
        const room = rooms.find(r => r.id === roomId);
        if (room) selectRoom(room);
      });
    }

    // 删除按钮事件
    const deleteBtn = item.querySelector('.room-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止触发选择房间
        deleteRoom(roomId);
      });
    }

    // 置顶按钮事件
    const pinBtn = item.querySelector('.room-pin-btn');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止触发选择房间
        togglePinRoom(roomId);
      });
    }
  });
}

// 渲染用户列表
function renderUserList() {
  // Add real users
  const userItems = onlineUsers
    .filter(u => u.id !== currentUser.id)
    .map(user => `
      <div class="user-item" data-user-id="${user.id}">
        <div class="user-item-avatar">${user.is_bot ? '🤖' : '👤'}</div>
        <div class="user-item-name">${escapeHtml(user.display_name || user.username)}</div>
        <div class="user-item-status ${isUserOnline(user) ? 'online' : 'offline'}"></div>
      </div>
    `);

  // Add Game Lobby as a virtual user (always online, always at the top)
  const gameLobbyItem = `
    <div class="user-item game-lobby-user" data-special="game-lobby">
      <div class="user-item-avatar">🎮</div>
      <div class="user-item-name">游戏大厅 / Game Lobby</div>
      <div class="user-item-status online"></div>
    </div>
  `;

  userList.innerHTML = gameLobbyItem + userItems.join('');

  // Bind click events
  document.querySelectorAll('.user-item').forEach(item => {
    item.addEventListener('click', () => {
      // Check if it's the game lobby virtual user
      if (item.dataset.special === 'game-lobby') {
        showGameLobby();
        // Mobile: Auto-hide sidebar after selecting
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('show');
        }
      } else {
        // Regular user: create private chat
        const userId = parseInt(item.dataset.userId);
        createPrivateChat(userId);
      }
    });
  });
}

// Select room
function selectRoom(room) {
  currentRoom = room;

  // Handle game lobby room differently
  if (room.id === 'game-lobby') {
    showGameLobby();
    // Re-render room list to apply active style
    renderRoomList();
    // Mobile: Auto-hide sidebar after selecting room
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('show');
    }
    return;
  }

  // Hide game lobby container if it exists
  const gameLobbyContainer = document.getElementById('gameLobbyContainer');
  if (gameLobbyContainer) {
    gameLobbyContainer.style.display = 'none';
  }

  // Show normal chat UI
  messageList.style.display = 'flex';
  inputArea.style.display = 'flex';

  currentRoomName.textContent = room.name;
  roomSubtitle.textContent = room.type === 'private' ? i18n.t('room.privateChat') : i18n.t('chat.rooms');

  // Re-render room list to apply active style
  renderRoomList();

  // Mobile: Auto-hide sidebar after selecting room
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('show');
  }

  // Load messages (without immediately clearing unread count)
  socket.emit('loadMessages', { roomId: room.id, limit: 50, skipClearUnread: true });
}

// Clear unread count for current room (when user interacts with content)
function clearCurrentRoomUnread() {
  if (currentRoom && unreadCounts[currentRoom.id]) {
    socket.emit('clearUnread', { roomId: currentRoom.id });
  }
}

// Create private chat
function createPrivateChat(targetUserId) {
  // Check if private chat room with this user already exists
  const existingRoom = rooms.find(r =>
    r.type === 'private' &&
    r.members &&
    r.members.some(m => m.id === targetUserId)
  );

  if (existingRoom) {
    // Select existing room, don't create duplicate
    console.log(`Private chat room with user ${targetUserId} already exists, selecting it`);
    selectRoom(existingRoom);
    return;
  }

  // 不存在才创建新房间
  socket.emit('createPrivateChat', { targetUserId });
}

// Delete room
function deleteRoom(roomId) {
  if (roomId === 'lobby') {
    alert(i18n.t('room.cannotDeleteLobby'));
    return;
  }

  const room = rooms.find(r => r.id === roomId);
  const roomName = room ? room.name : '';

  if (confirm(i18n.tp('room.confirmDelete', { name: roomName }))) {
    socket.emit('deleteRoom', { roomId });
  }
}

// Pin/unpin room
function togglePinRoom(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  const newPinnedState = room.pinned === 1 ? 0 : 1;
  socket.emit('togglePinRoom', { roomId, pinned: newPinnedState });
}

// Send message
function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !currentRoom) return;

  socket.emit('sendMessage', {
    roomId: currentRoom.id,
    text
  });

  messageInput.value = '';
  autoResizeTextarea();

  // Mobile: Reset viewport zoom after sending message
  if (window.innerWidth <= 768) {
    messageInput.blur(); // First lose focus
    setTimeout(() => {
      // Force reset viewport
      const viewport = document.querySelector('meta[name="viewport"]');
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }, 100);
  } else {
    messageInput.focus();
  }
}

// 添加消息到列表
function appendMessage(message) {
  const isOwn = message.user_id === currentUser.id;
  const isBot = message.is_bot === 1;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : ''} ${isBot ? 'bot' : ''}`;

  // Process message text: escape HTML first, then highlight mentions
  const processedText = highlightMentions(escapeHtml(message.text));

  messageDiv.innerHTML = `
    <div class="message-avatar">${isBot ? '🤖' : '👤'}</div>
    <div class="message-content">
      ${!isOwn ? `
        <div class="message-header">
          <span class="message-sender">${escapeHtml(message.display_name || message.username)}</span>
          <span class="message-time">${formatTime(message.created_at)}</span>
        </div>
      ` : ''}
      <div class="message-bubble">${processedText}</div>
      ${isOwn ? `
        <div class="message-header">
          <span class="message-time">${formatTime(message.created_at)}</span>
        </div>
      ` : ''}
    </div>
  `;

  // 移除欢迎消息
  const welcomeMsg = messageList.querySelector('.welcome-message');
  if (welcomeMsg) welcomeMsg.remove();

  messageList.appendChild(messageDiv);
  scrollToBottom();
}

// 更新房间预览
function updateRoomPreview(roomId, text, username, displayName) {
  // 更新 rooms 数组中的 lastMessage
  const room = rooms.find(r => r.id === roomId);
  if (room) {
    room.lastMessage = {
      text: text,
      username: username,
      display_name: displayName
    };
  }

  // 更新 DOM 中的预览元素
  const previewEl = document.getElementById(`room-preview-${roomId}`);
  if (previewEl) {
    previewEl.textContent = text.substring(0, 30) + (text.length > 30 ? '...' : '');
  }
}

// 搜索消息
function handleSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    searchResults.classList.add('hidden');
    return;
  }

  socket.emit('searchMessages', {
    query,
    roomId: currentRoom?.id
  });
}

// Render search results
function renderSearchResults(results) {
  if (results.length === 0) {
    searchResults.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">${i18n.t('search.noResults')}</div>`;
  } else {
    searchResults.innerHTML = results.map(result => {
      const query = searchInput.value.trim();
      const highlightedText = result.text.replace(
        new RegExp(escapeRegex(query), 'gi'),
        match => `<mark>${match}</mark>`
      );

      return `
        <div class="search-result-item">
          <div class="search-result-room">${escapeHtml(result.room_name)}</div>
          <div class="search-result-text">${highlightedText}</div>
        </div>
      `;
    }).join('');
  }

  searchResults.classList.remove('hidden');
}

// Auto-resize textarea height
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// Scroll to bottom
function scrollToBottom() {
  setTimeout(() => {
    messageList.scrollTop = messageList.scrollHeight;
  }, 100);
}

// Update connection status
function updateConnectionStatus(status) {
  connectionStatus.className = `connection-status ${status}`;

  const statusText = connectionStatus.querySelector('.status-text');
  if (status === 'connected') {
    statusText.textContent = i18n.t('connection.connected');
  } else if (status === 'disconnected') {
    statusText.textContent = i18n.t('connection.disconnected');
  } else {
    statusText.textContent = i18n.t('connection.connecting');
  }

  // Show status indicator
  connectionStatus.classList.add('show');

  // Auto-hide after 3 seconds (only when connected)
  if (status === 'connected') {
    setTimeout(() => {
      connectionStatus.classList.remove('show');
    }, 3000);
  }
}

// Check if user is online
function isUserOnline(user) {
  if (!user.last_seen) return false;
  const lastSeen = new Date(user.last_seen);
  const now = new Date();
  return (now - lastSeen) < 5 * 60 * 1000; // Active within 5 minutes
}

// Logout
function logout() {
  localStorage.removeItem('chatToken');
  localStorage.removeItem('chatUser');
  window.location.href = '/index.html';
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight @mentions in message text
function highlightMentions(text) {
  // Match @username pattern (username can contain letters, numbers, hyphens, underscores, and Chinese characters)
  return text.replace(/@([\w\u4e00-\u9fa5_-]+)/g, '<span class="mention">@$1</span>');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return i18n.t('time.justNow');
  if (diffMins < 60) return i18n.tp('time.minutesAgo', { n: diffMins });

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return i18n.tp('time.hoursAgo', { n: diffHours });

  const locale = i18n.currentLang === 'zh-CN' ? 'zh-CN' : 'en-US';
  return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// @ Mention autocomplete
let mentionDropdown = null;
let mentionStartPos = null;
let mentionQuery = '';

function handleMessageInput(e) {
  const text = messageInput.value;
  const cursorPos = messageInput.selectionStart;

  // 查找最后一个 @ 符号的位置
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastAtPos = textBeforeCursor.lastIndexOf('@');

  if (lastAtPos !== -1) {
    // 检查 @ 后面的文本（不包含空格）
    const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);

    if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
      // 显示用户列表
      mentionQuery = textAfterAt.toLowerCase();
      mentionStartPos = lastAtPos;
      showMentionSuggestions();
      return;
    }
  }

  // 隐藏提示
  hideMentionSuggestions();
}

function showMentionSuggestions() {
  // 获取可 @ 的用户列表
  let availableUsers = [];

  if (!currentRoom) {
    return; // No room selected
  }

  // 如果是大厅（lobby），显示所有在线用户
  if (currentRoom.id === 'lobby') {
    availableUsers = onlineUsers.filter(u => u.id !== currentUser.id);
  }
  // 如果是私聊房间，只显示房间成员（对方用户）
  else if (currentRoom.type === 'private' && currentRoom.members) {
    availableUsers = currentRoom.members.filter(u => u.id !== currentUser.id);
  }
  // 如果是群聊房间，显示房间成员
  else if (currentRoom.members) {
    availableUsers = currentRoom.members.filter(u => u.id !== currentUser.id);
  }
  // 兜底：如果没有 members 字段，显示所有在线用户
  else {
    availableUsers = onlineUsers.filter(u => u.id !== currentUser.id);
  }

  // 过滤和搜索用户
  const suggestions = availableUsers
    .filter(u => {
      const username = (u.username || '').toLowerCase();
      const displayName = (u.display_name || '').toLowerCase();
      return username.includes(mentionQuery) || displayName.includes(mentionQuery);
    })
    .slice(0, 5); // 最多显示 5 个

  if (suggestions.length === 0) {
    hideMentionSuggestions();
    return;
  }

  // 创建或更新下拉列表
  if (!mentionDropdown) {
    mentionDropdown = document.createElement('div');
    mentionDropdown.className = 'mention-dropdown';
    document.body.appendChild(mentionDropdown);
  }

  // 渲染用户列表
  mentionDropdown.innerHTML = suggestions.map((user, index) => `
    <div class="mention-item" data-index="${index}" data-username="${escapeHtml(user.username)}">
      <span class="mention-avatar">${user.is_bot ? '🤖' : '👤'}</span>
      <span class="mention-name">${escapeHtml(user.display_name || user.username)}</span>
      <span class="mention-username">@${escapeHtml(user.username)}</span>
    </div>
  `).join('');

  // 定位下拉列表
  const inputRect = messageInput.getBoundingClientRect();
  mentionDropdown.style.left = inputRect.left + 'px';
  mentionDropdown.style.bottom = (window.innerHeight - inputRect.top + 10) + 'px';
  mentionDropdown.style.width = inputRect.width + 'px';
  mentionDropdown.style.display = 'block';

  // 绑定点击事件
  mentionDropdown.querySelectorAll('.mention-item').forEach(item => {
    item.addEventListener('click', () => {
      insertMention(item.dataset.username);
    });
  });
}

function hideMentionSuggestions() {
  if (mentionDropdown) {
    mentionDropdown.style.display = 'none';
  }
  mentionStartPos = null;
  mentionQuery = '';
}

function insertMention(username) {
  const text = messageInput.value;
  const before = text.substring(0, mentionStartPos);
  const after = text.substring(messageInput.selectionStart);

  messageInput.value = before + '@' + username + ' ' + after;
  messageInput.setSelectionRange(
    before.length + username.length + 2,
    before.length + username.length + 2
  );

  hideMentionSuggestions();
  messageInput.focus();
  autoResizeTextarea();
}

// 增强键盘处理
function handleMessageInputKeydown(e) {
  // 如果下拉列表显示，处理上下箭头和回车
  if (mentionDropdown && mentionDropdown.style.display === 'block') {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
      e.preventDefault();
      const items = mentionDropdown.querySelectorAll('.mention-item');
      const current = mentionDropdown.querySelector('.mention-item.active');

      if (current) {
        current.classList.remove('active');
        let index = parseInt(current.dataset.index);

        if (e.key === 'ArrowDown' || e.key === 'Tab') {
          index = (index + 1) % items.length;
        }else {
          index = (index - 1 + items.length) % items.length;
        }

        items[index].classList.add('active');
      } else if (items.length > 0) {
        items[0].classList.add('active');
      }
      return;
    }

    if (e.key === 'Enter') {
      const active = mentionDropdown.querySelector('.mention-item.active');
      if (active) {
        e.preventDefault();
        insertMention(active.dataset.username);
        return;
      }
    }

    if (e.key === 'Escape') {
      hideMentionSuggestions();
      return;
    }
  }

  // 原有的 Enter 发送逻辑
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// 点击外部关闭下拉列表
document.addEventListener('click', (e) => {
  if (mentionDropdown && !messageInput.contains(e.target) && !mentionDropdown.contains(e.target)) {
    hideMentionSuggestions();
  }
});

// 显示修改密码模态框
function showChangePasswordModal() {
  changePasswordModal.classList.add('show');
  currentPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmPasswordInput.value = '';
  passwordError.textContent = '';
  currentPasswordInput.focus();
}

// 隐藏修改密码模态框
function hideChangePasswordModal() {
  changePasswordModal.classList.remove('show');
}

// 处理修改密码
async function handleChangePassword() {
  const currentPassword = currentPasswordInput.value.trim();
  const newPassword = newPasswordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

  // Validate input
  if (!currentPassword) {
    passwordError.textContent = i18n.t('error.passwordRequired');
    return;
  }

  if (!newPassword) {
    passwordError.textContent = i18n.t('error.passwordRequired');
    return;
  }

  if (newPassword.length < 6) {
    passwordError.textContent = i18n.t('error.passwordTooShort');
    return;
  }

  if (newPassword !== confirmPassword) {
    passwordError.textContent = i18n.t('error.passwordMismatch');
    return;
  }

  if (currentPassword === newPassword) {
    passwordError.textContent = i18n.t('error.passwordSame');
    return;
  }

  // Disable button to prevent duplicate submissions
  confirmPasswordChange.disabled = true;
  confirmPasswordChange.textContent = i18n.t('modal.changingPassword');
  passwordError.textContent = '';

  try {
    const response = await fetch('/api/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(i18n.t('success.passwordChanged'));
      logout();
    } else {
      passwordError.textContent = result.error || i18n.t('error.changePasswordFailed');
    }
  } catch (error) {
    console.error('Password change failed:', error);
    passwordError.textContent = i18n.t('login.networkError');
  } finally {
    confirmPasswordChange.disabled = false;
    confirmPasswordChange.textContent = i18n.t('modal.confirm');
  }
}

// Click outside modal to close
changePasswordModal.addEventListener('click', (e) => {
  if (e.target === changePasswordModal) {
    hideChangePasswordModal();
  }
});

// ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && changePasswordModal.classList.contains('show')) {
    hideChangePasswordModal();
  }
});

// ============================================================
// Game Lobby Integration
// ============================================================

// Cache for game progress
window.__cachedGameProgress = {};

// Show game lobby
function showGameLobby() {
  // Hide normal chat UI elements
  inputArea.style.display = 'none';
  messageList.style.display = 'none';

  // Update header
  currentRoomName.textContent = '🎮 游戏大厅';
  roomSubtitle.textContent = '';

  // Create or get game lobby container (as sibling to messageList, not child)
  let gameLobbyContainer = document.getElementById('gameLobbyContainer');
  let isFirstTime = false;

  if (!gameLobbyContainer) {
    isFirstTime = true;
    gameLobbyContainer = document.createElement('div');
    gameLobbyContainer.id = 'gameLobbyContainer';
    gameLobbyContainer.className = 'game-lobby-container';
    messageList.parentElement.appendChild(gameLobbyContainer);
  }

  gameLobbyContainer.style.display = 'flex';

  // Only inject HTML on first creation to avoid re-creating iframes
  if (isFirstTime) {
    gameLobbyContainer.innerHTML = `
      <div class="game-lobby-header">
        <h2>🎮 游戏大厅 / Game Lobby</h2>
        <p>选择一个游戏开始挑战 / Choose a game to start</p>
      </div>

      <div class="game-grid">
        <div class="game-card" data-game="sliding-puzzle">
          <div class="game-icon">🧩</div>
          <h3>数字华容道</h3>
          <p>9 关卡 · 滑块解谜</p>
        </div>

        <div class="game-card" data-game="memory-game">
          <div class="game-icon">🃏</div>
          <h3>记忆翻牌</h3>
          <p>9 关卡 · 配对记忆</p>
        </div>

        <div class="game-card" data-game="math-challenge">
          <div class="game-icon">🔢</div>
          <h3>速算挑战</h3>
          <p>9 关卡 · 限时计算</p>
        </div>

        <div class="game-card" data-game="poetry-game">
          <div class="game-icon">📖</div>
          <h3>古诗背诵</h3>
          <p>13 首 · 小学必背</p>
        </div>
      </div>

      <div id="gamePlayerFrame" style="display:none;">
        <button class="btn-back-to-lobby">← 返回游戏大厅</button>
        <iframe id="gameIframe" src="" frameborder="0"></iframe>
      </div>
    `;

    // Attach click handlers (only once)
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        launchGame(card.dataset.game);
      });
    });

    // Back button handler (only once)
    const backBtn = document.querySelector('.btn-back-to-lobby');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const gameLobbyHeader = document.querySelector('.game-lobby-header');
        const gameGrid = document.querySelector('.game-grid');
        const gamePlayerFrame = document.getElementById('gamePlayerFrame');

        if (gamePlayerFrame) gamePlayerFrame.style.display = 'none';
        if (gameLobbyHeader) gameLobbyHeader.style.display = 'block';
        if (gameGrid) gameGrid.style.display = 'grid';
      });
    }
  }
}

// Launch game in iframe
function launchGame(gameName) {
  // Hide game grid and header, show iframe
  const gameLobbyHeader = document.querySelector('.game-lobby-header');
  const gameGrid = document.querySelector('.game-grid');
  const gamePlayerFrame = document.getElementById('gamePlayerFrame');

  if (gameLobbyHeader) gameLobbyHeader.style.display = 'none';
  if (gameGrid) gameGrid.style.display = 'none';
  if (gamePlayerFrame) gamePlayerFrame.style.display = 'flex';

  // Load game in iframe
  const iframe = document.getElementById('gameIframe');
  const gameFileMap = {
    'sliding_puzzle': 'sliding-puzzle.html',
    'memory_game': 'memory-game.html',
    'math_challenge': 'math-challenge.html',
    'poetry_game': 'poetry-game.html'
  };

  iframe.src = `/games/${gameFileMap[gameName] || gameName + '.html'}`;

  console.log(`🎮 Launching game: ${gameName}`);
}

// PostMessage bridge: Listen for messages from game iframes
window.addEventListener('message', (event) => {
  // Security: validate origin (optional, can skip for localhost)
  // if (event.origin !== window.location.origin) return;

  const { type, game, level, stars, moves, timeSeconds } = event.data;

  if (type === 'requestGameProgress') {
    // Game is requesting its progress data - now handled by gameReady event
    // Just send cached data if available for immediate display
    if (window.__cachedGameProgress && window.__cachedGameProgress[game]) {
      const iframe = document.getElementById('gameIframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'loadProgress',
          progress: window.__cachedGameProgress[game]
        }, '*');
      }
    }
  }
  else if (type === 'saveGameProgress') {
    // Game completed a level, save to server
    socket.emit('saveGameProgress', {
      gameName: game,
      level,
      stars,
      moves,
      timeSeconds
    });
  }
  else if (type === 'gameReady') {
    // Game loaded and ready, always request fresh progress from server
    console.log(`🎮 Game ready: ${game}, requesting progress...`);
    socket.emit('getGameProgress', { gameName: game });

    // Also send cached data immediately if available (for instant display)
    if (window.__cachedGameProgress && window.__cachedGameProgress[game]) {
      const iframe = document.getElementById('gameIframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'loadProgress',
          progress: window.__cachedGameProgress[game]
        }, '*');
      }
    }
  }
});

// Listen for game progress from server
socket.on('gameProgress', (data) => {
  const { gameName, stars, unlocked } = data;

  // Cache for iframe to consume
  if (!window.__cachedGameProgress) {
    window.__cachedGameProgress = {};
  }
  window.__cachedGameProgress[gameName] = { stars, unlocked };

  // If iframe is active, send immediately
  const iframe = document.getElementById('gameIframe');
  if (iframe && iframe.src) {
    // Convert game name format: sliding_puzzle -> sliding-puzzle
    const gameFileName = gameName.replace(/_/g, '-');
    if (iframe.src.includes(gameFileName)) {
      iframe.contentWindow.postMessage({
        type: 'loadProgress',
        progress: { stars, unlocked }
      }, '*');
      console.log(`📤 Sent progress to ${gameName} iframe:`, { stars, unlocked });
    }
  }

  console.log('✅ Game progress loaded:', data);
});

socket.on('gameProgressSaved', (data) => {
  console.log('✅ Game progress saved:', data);
  // Could show a toast notification here
});

