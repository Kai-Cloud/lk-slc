/**
 * i18n - Internationalization system
 * Supports Chinese (zh-CN) and English (en-US)
 */

const i18n = {
  // Current language (default: Chinese)
  currentLang: localStorage.getItem('language') || 'zh-CN',

  // Translation dictionaries
  translations: {
    'zh-CN': {
      // Login page
      'login.title': '简单局域网聊天',
      'login.username': '用户名',
      'login.password': '密码',
      'login.button': '登录 / 注册',
      'login.tip': '💡 提示：首次登录会自动注册账号',
      'login.validationError': '请填写用户名和密码',
      'login.networkError': '网络错误，请检查服务器是否运行',

      // Chat page - Sidebar
      'chat.title': '💬 聊天',
      'chat.logout': '登出',
      'chat.settings': '设置',
      'chat.online': '在线',
      'chat.rooms': '房间',
      'chat.onlineUsers': '在线用户',
      'chat.refresh': '刷新',

      // Chat page - Main
      'chat.selectRoom': '选择一个房间开始聊天',
      'chat.search': '搜索消息',
      'chat.inputPlaceholder': '输入消息... (Enter 发送, Shift+Enter 换行)',
      'chat.send': '发送',
      'chat.welcome': '👋 欢迎来到简单局域网聊天',
      'chat.welcomeDesc': '选择左侧的房间开始聊天，或点击用户发起私聊',

      // Change password modal
      'modal.changePassword': '修改密码',
      'modal.currentPassword': '当前密码',
      'modal.newPassword': '新密码',
      'modal.confirmPassword': '确认新密码',
      'modal.cancel': '取消',
      'modal.confirm': '确认修改',
      'modal.changingPassword': '修改中...',

      // Room actions
      'room.pin': '置顶',
      'room.unpin': '取消置顶',
      'room.delete': '删除',
      'room.lobby': '大厅',
      'room.startChat': '开始聊天...',
      'room.privateChat': '私聊',
      'room.cannotDeleteLobby': '不能删除大厅',
      'room.confirmDelete': '确定要删除对话 "{name}" 吗？',

      // Search
      'search.noResults': '未找到匹配的消息',

      // Time
      'time.justNow': '刚刚',
      'time.minutesAgo': '{n}分钟前',
      'time.hoursAgo': '{n}小时前',

      // Connection status
      'connection.connecting': '连接中...',
      'connection.connected': '已连接',
      'connection.disconnected': '连接断开',
      'connection.reconnecting': '重新连接中...',

      // Error messages
      'error.loginFailed': '登录失败',
      'error.invalidCredentials': '用户名或密码错误',
      'error.usernameRequired': '用户名不能为空',
      'error.passwordRequired': '密码不能为空',
      'error.connectionError': '连接服务器失败',
      'error.sendFailed': '发送消息失败',
      'error.passwordMismatch': '两次输入的密码不一致',
      'error.passwordTooShort': '新密码至少需要6位字符',
      'error.currentPasswordWrong': '当前密码错误',
      'error.passwordSame': '新密码不能与当前密码相同',
      'error.changePasswordFailed': '修改密码失败',

      // Success messages
      'success.passwordChanged': '密码修改成功，请重新登录',
      'success.messageSent': '消息已发送',

      // Misc
      'loading': '加载中...',
      'members': '成员',
      'you': '你',
      'bot': 'Bot'
    },

    'en-US': {
      // Login page
      'login.title': 'Simple LAN Chat',
      'login.username': 'Username',
      'login.password': 'Password',
      'login.button': 'Login / Register',
      'login.tip': '💡 Tip: First-time login will automatically register an account',
      'login.validationError': 'Please enter username and password',
      'login.networkError': 'Network error, please check if server is running',

      // Chat page - Sidebar
      'chat.title': '💬 Chat',
      'chat.logout': 'Logout',
      'chat.settings': 'Settings',
      'chat.online': 'Online',
      'chat.rooms': 'Rooms',
      'chat.onlineUsers': 'Online Users',
      'chat.refresh': 'Refresh',

      // Chat page - Main
      'chat.selectRoom': 'Select a room to start chatting',
      'chat.search': 'Search Messages',
      'chat.inputPlaceholder': 'Type a message... (Enter to send, Shift+Enter for new line)',
      'chat.send': 'Send',
      'chat.welcome': '👋 Welcome to Simple LAN Chat',
      'chat.welcomeDesc': 'Select a room on the left to start chatting, or click a user to start a private chat',

      // Change password modal
      'modal.changePassword': 'Change Password',
      'modal.currentPassword': 'Current Password',
      'modal.newPassword': 'New Password',
      'modal.confirmPassword': 'Confirm New Password',
      'modal.cancel': 'Cancel',
      'modal.confirm': 'Confirm',
      'modal.changingPassword': 'Changing...',

      // Room actions
      'room.pin': 'Pin',
      'room.unpin': 'Unpin',
      'room.delete': 'Delete',
      'room.lobby': 'Lobby',
      'room.startChat': 'Start chatting...',
      'room.privateChat': 'Private Chat',
      'room.cannotDeleteLobby': 'Cannot delete lobby',
      'room.confirmDelete': 'Are you sure you want to delete "{name}"?',

      // Search
      'search.noResults': 'No matching messages found',

      // Time
      'time.justNow': 'Just now',
      'time.minutesAgo': '{n} minutes ago',
      'time.hoursAgo': '{n} hours ago',

      // Connection status
      'connection.connecting': 'Connecting...',
      'connection.connected': 'Connected',
      'connection.disconnected': 'Disconnected',
      'connection.reconnecting': 'Reconnecting...',

      // Error messages
      'error.loginFailed': 'Login Failed',
      'error.invalidCredentials': 'Invalid username or password',
      'error.usernameRequired': 'Username is required',
      'error.passwordRequired': 'Password is required',
      'error.connectionError': 'Failed to connect to server',
      'error.sendFailed': 'Failed to send message',
      'error.passwordMismatch': 'Passwords do not match',
      'error.passwordTooShort': 'New password must be at least 6 characters',
      'error.currentPasswordWrong': 'Current password is incorrect',
      'error.passwordSame': 'New password cannot be the same as current password',
      'error.changePasswordFailed': 'Failed to change password',

      // Success messages
      'success.passwordChanged': 'Password changed successfully, please login again',
      'success.messageSent': 'Message sent',

      // Misc
      'loading': 'Loading...',
      'members': 'Members',
      'you': 'You',
      'bot': 'Bot'
    }
  },

  /**
   * Get translated text for a key
   * @param {string} key - Translation key
   * @param {string} [lang] - Language code (optional, defaults to currentLang)
   * @returns {string} Translated text
   */
  t(key, lang) {
    const language = lang || this.currentLang;
    const translation = this.translations[language]?.[key];

    if (!translation) {
      console.warn(`[i18n] Missing translation for key: ${key} (lang: ${language})`);
      return key;
    }

    return translation;
  },

  /**
   * Translate with parameters (for template strings like "{n} minutes ago")
   * @param {string} key - Translation key
   * @param {Object} params - Parameters to replace in template (e.g., {n: 5})
   * @returns {string} Translated text with replaced parameters
   */
  tp(key, params) {
    let text = this.t(key);
    if (params) {
      Object.keys(params).forEach(k => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), params[k]);
      });
    }
    return text;
  },

  /**
   * Set current language
   * @param {string} lang - Language code ('zh-CN' or 'en-US')
   */
  setLanguage(lang) {
    if (!this.translations[lang]) {
      console.error(`[i18n] Unsupported language: ${lang}`);
      return;
    }

    this.currentLang = lang;
    localStorage.setItem('language', lang);

    // Trigger custom event for language change
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { lang } }));
  },

  /**
   * Get current language
   * @returns {string} Current language code
   */
  getLanguage() {
    return this.currentLang;
  },

  /**
   * Initialize i18n system
   */
  init() {
    // Apply stored language or default to Chinese
    const storedLang = localStorage.getItem('language') || 'zh-CN';
    this.currentLang = storedLang;

    console.log(`[i18n] Initialized with language: ${storedLang}`);
  }
};

// Initialize on load
i18n.init();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
}
