// 全局变量
let socket = null;
let currentUser = null;
let currentRoom = null;
let rooms = [];
let onlineUsers = [];

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

  // 自动调整输入框高度
  messageInput.addEventListener('input', autoResizeTextarea);
}

// 连接 Socket.io
function connectSocket() {
  socket = io({
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('✅ Socket.io 已连接');
    updateConnectionStatus('connected');

    // 使用 token 登录
    socket.emit('loginWithToken', { token });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket.io 已断开');
    updateConnectionStatus('disconnected');
  });

  socket.on('loginSuccess', (data) => {
    console.log('✅ 登录成功:', data.user);
    currentUser = data.user;
  });

  socket.on('loginError', (data) => {
    console.error('❌ 登录失败:', data.message);
    alert('登录失败: ' + data.message);
    logout();
  });

  socket.on('roomList', (data) => {
    rooms = data;
    renderRoomList();

    // 自动选择第一个房间（大厅）
    if (rooms.length > 0 && !currentRoom) {
      selectRoom(rooms[0]);
    }
  });

  socket.on('message', (message) => {
    if (message.room_id === currentRoom?.id) {
      appendMessage(message);
    }

    // 更新房间预览
    updateRoomPreview(message.room_id, message.text);
  });

  socket.on('messages', (data) => {
    if (data.roomId === currentRoom?.id) {
      messageList.innerHTML = '';
      data.messages.forEach(msg => appendMessage(msg));
      scrollToBottom();
    }
  });

  socket.on('userOnline', (user) => {
    console.log('👤 用户上线:', user.username);
    socket.emit('getOnlineUsers');
  });

  socket.on('userOffline', (user) => {
    console.log('👤 用户离线:', user.username);
    socket.emit('getOnlineUsers');
  });

  socket.on('onlineUsers', (users) => {
    onlineUsers = users;
    renderUserList();
  });

  socket.on('userStatusUpdate', (data) => {
    // 更新用户的 last_seen 时间
    const user = onlineUsers.find(u => u.id === data.id);
    if (user) {
      user.last_seen = data.lastSeen;
      renderUserList();
    }
  });

  socket.on('roomCreated', (room) => {
    rooms.push(room);
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
    alert('错误: ' + data.message);
  });

  // 请求在线用户
  setTimeout(() => {
    socket.emit('getOnlineUsers');
  }, 1000);
}

// 渲染房间列表
function renderRoomList() {
  roomList.innerHTML = rooms.map(room => `
    <div class="room-item ${room.id === currentRoom?.id ? 'active' : ''}" data-room-id="${room.id}">
      <div class="room-item-content">
        <div class="room-item-title">${escapeHtml(room.name)}</div>
        <div class="room-item-preview" id="room-preview-${room.id}">
          ${room.lastMessage ? escapeHtml(room.lastMessage.text.substring(0, 30)) : '开始聊天...'}
        </div>
      </div>
      ${room.id !== 'lobby' ? '<button class="room-delete-btn" title="删除对话">🗑️</button>' : ''}
    </div>
  `).join('');

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
  });
}

// 渲染用户列表
function renderUserList() {
  userList.innerHTML = onlineUsers
    .filter(u => u.id !== currentUser.id)
    .map(user => `
      <div class="user-item" data-user-id="${user.id}">
        <div class="user-item-avatar">${user.is_bot ? '🤖' : '👤'}</div>
        <div class="user-item-name">${escapeHtml(user.display_name || user.username)}</div>
        <div class="user-item-status ${isUserOnline(user) ? 'online' : 'offline'}"></div>
      </div>
    `).join('');

  // 绑定点击事件（创建私聊）
  document.querySelectorAll('.user-item').forEach(item => {
    item.addEventListener('click', () => {
      const userId = parseInt(item.dataset.userId);
      createPrivateChat(userId);
    });
  });
}

// 选择房间
function selectRoom(room) {
  currentRoom = room;
  currentRoomName.textContent = room.name;
  roomSubtitle.textContent = room.type === 'private' ? '私聊' : '群聊';

  inputArea.style.display = 'flex';
  messageInput.focus();

  // 重新渲染房间列表以应用 active 样式
  renderRoomList();

  // 加载消息
  socket.emit('loadMessages', { roomId: room.id, limit: 50 });
}

// 创建私聊
function createPrivateChat(targetUserId) {
  socket.emit('createPrivateChat', { targetUserId });
}

// 删除房间
function deleteRoom(roomId) {
  if (roomId === 'lobby') {
    alert('不能删除大厅');
    return;
  }

  const room = rooms.find(r => r.id === roomId);
  const roomName = room ? room.name : '对话';

  if (confirm(`确定要删除对话"${roomName}"吗？`)) {
    socket.emit('deleteRoom', { roomId });
  }
}

// 发送消息
function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !currentRoom) return;

  socket.emit('sendMessage', {
    roomId: currentRoom.id,
    text
  });

  messageInput.value = '';
  autoResizeTextarea();
  messageInput.focus();
}

// 添加消息到列表
function appendMessage(message) {
  const isOwn = message.user_id === currentUser.id;
  const isBot = message.is_bot === 1;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : ''} ${isBot ? 'bot' : ''}`;

  messageDiv.innerHTML = `
    <div class="message-avatar">${isBot ? '🤖' : '👤'}</div>
    <div class="message-content">
      ${!isOwn ? `
        <div class="message-header">
          <span class="message-sender">${escapeHtml(message.display_name || message.username)}</span>
          <span class="message-time">${formatTime(message.created_at)}</span>
        </div>
      ` : ''}
      <div class="message-bubble">${escapeHtml(message.text)}</div>
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
function updateRoomPreview(roomId, text) {
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

// 渲染搜索结果
function renderSearchResults(results) {
  if (results.length === 0) {
    searchResults.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">未找到匹配的消息</div>';
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

// 自动调整输入框高度
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// 滚动到底部
function scrollToBottom() {
  setTimeout(() => {
    messageList.scrollTop = messageList.scrollHeight;
  }, 100);
}

// 更新连接状态
function updateConnectionStatus(status) {
  connectionStatus.className = `connection-status ${status}`;

  const statusText = connectionStatus.querySelector('.status-text');
  if (status === 'connected') {
    statusText.textContent = '已连接';
  } else if (status === 'disconnected') {
    statusText.textContent = '已断开';
  } else {
    statusText.textContent = '连接中...';
  }
}

// 判断用户是否在线
function isUserOnline(user) {
  if (!user.last_seen) return false;
  const lastSeen = new Date(user.last_seen);
  const now = new Date();
  return (now - lastSeen) < 5 * 60 * 1000; // 5 分钟内活跃
}

// 登出
function logout() {
  localStorage.removeItem('chatToken');
  localStorage.removeItem('chatUser');
  window.location.href = '/index.html';
}

// 工具函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', {
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

// @ 提及自动补全
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
  // 过滤用户列表
  const suggestions = onlineUsers
    .filter(u => {
      if (u.id === currentUser.id) return false;
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
