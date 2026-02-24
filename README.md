# 简单局域网聊天系统 (Simple LAN Chat)

一个极简、易用的局域网聊天系统，专为家庭和小团队设计。

## 🎯 核心特性

- ✅ **极简部署**: 一条命令启动服务器
- ✅ **零配置**: 用户首次登录自动注册
- ✅ **自动群聊**: 所有用户加入默认大厅
- ✅ **私聊支持**: 点击用户名发起私聊
- ✅ **实时通信**: WebSocket 实时消息
- ✅ **Bot 友好**: 简单的 Bot API
- ✅ **多端支持**: 网页端 + 未来的移动 App
- ✅ **轻量级**: SQLite 数据库,占用 < 50MB RAM
- ✅ **聊天记录**: 自动保存,支持搜索

## 📦 技术栈

- **后端**: Node.js + Express + Socket.io + SQLite
- **前端**: 纯 HTML + CSS + JavaScript (无框架依赖)
- **数据库**: SQLite (零配置,文件存储)
- **实时通信**: Socket.io (WebSocket + 降级支持)

## 🚀 快速开始 (Ubuntu 推荐)

### 前置条件

**Ubuntu/Debian 系统需先安装构建工具:**

```bash
# 更新包索引
sudo apt-get update

# 安装 Node.js 22、编译工具和 Python
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3

# 验证安装
node --version  # 应显示 v22.x.x
gcc --version
python3 --version
```

### 1. 克隆仓库

```bash
git clone https://github.com/Kai-Cloud/lk-slc.git
cd lk-slc
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 或生产模式
npm start
```

服务器会在 `http://localhost:3030` 启动

### 4. 访问应用

- **本地**: http://localhost:3030
- **局域网**: http://YOUR_IP:3030 (使用 `ip addr` 查看 IP 地址)

### 5. 首次登录

1. 输入用户名（例如: `alice`, `bob`, `gpt-bot`）
2. 设置密码（首次登录时自动注册）
3. 自动进入"大厅"群聊

## 📱 移动端支持

### 方案 1: 保存为书签（最简单）

1. 在手机浏览器访问 `http://服务器IP:3030`
2. iOS: 分享 → 添加到主屏幕
3. Android: 菜单 → 添加到主屏幕

表现类似原生 App，无需安装！

### 方案 2: 自动登录链接

生成专属链接，家人点击即可免密登录:

```
http://服务器IP:3030/?token=自动生成的令牌
```

在服务器管理面板生成并分享给家人。

### 方案 3: 原生 App（未来）

使用 React Native 或 Flutter 开发原生 App。

## 🤖 Bot 集成

### 配置 Bot

1. **创建 Bot 环境配置文件**:
   ```bash
   cd bots
   cp .env.example .env
   nano .env  # 或使用其他编辑器
   ```

2. **编辑配置**:
   ```env
   # 服务器地址
   SERVER_URL=http://localhost:3030  # 本地部署
   # SERVER_URL=https://your-domain.com:63030  # HTTPS 部署

   # Bot 用户名和密码
   BOT_USERNAME=gpt-bot
   BOT_PASSWORD=your-bot-password-here

   # Microsoft Foundry GPT-4o 配置
   FOUNDRY_ENDPOINT=https://your-foundry-endpoint.azure.com/v1/chat/completions
   FOUNDRY_API_KEY=your-foundry-api-key-here
   ```

3. **首次运行前需在网页端注册 Bot 账号**:
   - 访问 http://localhost:3030
   - 使用 Bot 的用户名和密码登录一次（会自动注册）
   - 登出

4. **启动 Bot**:
   ```bash
   node bots/gpt-bot.js
   ```

### Bot 示例代码

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3030');

// 登录
socket.emit('login', {
  username: 'gpt-bot',
  password: 'your-bot-password'
});

// 监听消息
socket.on('message', async (data) => {
  if (data.text.includes('@gpt-bot')) {
    const reply = await callGPT4o(data.text);
    socket.emit('sendMessage', {
      roomId: data.roomId,
      text: reply
    });
  }
});
```

**使用 Bot**: 在聊天室中发送 `@gpt-bot 你的问题` 即可与 GPT-4o 对话。

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────┐
│              客户端层                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 网页端   │ │ iOS App  │ │Android App│   │
│  └────┬─────┘ └────┬─────┘ └────┬──────┘   │
│       └────────────┼────────────┘           │
│                    │ WebSocket              │
└────────────────────┼────────────────────────┘
                     │
┌────────────────────┼────────────────────────┐
│              服务器层                        │
│       ┌────────────▼──────────┐             │
│       │   Socket.io Server    │             │
│       └───────────┬───────────┘             │
│                   │                          │
│       ┌───────────▼───────────┐             │
│       │  聊天逻辑处理层        │             │
│       │  - 消息路由            │             │
│       │  - 在线状态管理        │             │
│       │  - 私聊/群聊管理       │             │
│       └───────────┬───────────┘             │
│                   │                          │
│       ┌───────────▼───────────┐             │
│       │   SQLite 数据库        │             │
│       │  - users (用户)        │             │
│       │  - rooms (房间)        │             │
│       │  - messages (消息)     │             │
│       │  - sessions (会话)     │             │
│       └───────────────────────┘             │
└─────────────────────────────────────────────┘
```

## 📂 项目结构

```
simple-lan-chat/
├── server/
│   ├── index.js          # 主服务器
│   ├── db.js             # 数据库操作
│   ├── auth.js           # 认证逻辑
│   ├── chat.js           # 聊天逻辑
│   └── bot-api.js        # Bot API
├── public/
│   ├── index.html        # 登录页面
│   ├── chat.html         # 聊天界面
│   ├── css/
│   │   └── style.css     # 样式
│   └── js/
│       └── app.js        # 客户端逻辑
├── bots/
│   └── gpt-bot.js        # GPT-4o Bot 示例
├── data/
│   └── chat.db           # SQLite 数据库文件
├── package.json
├── .env.example
└── README.md
```

## 💾 数据库结构

### users 表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  is_bot INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### rooms 表
```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('group', 'private')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### messages 表
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### room_members 表
```sql
CREATE TABLE room_members (
  room_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);
```

## 🔐 安全性

### 局域网环境
- ✅ 密码哈希存储 (bcrypt)
- ✅ JWT Token 认证
- ⚠️ 不使用 HTTPS (局域网内不需要)
- ⚠️ 不防 DDoS (信任局域网用户)

### 未来增强（可选）
- 添加简单的 HTTPS 支持
- 消息端到端加密
- 文件传输加密

## 🎨 界面设计

### 简洁风格
- 类似 WhatsApp/Telegram 的简洁界面
- 左侧: 房间列表 + 在线用户
- 右侧: 聊天窗口
- 移动端自适应布局

### 功能
- ✅ 实时消息
- ✅ 在线状态指示
- ✅ 消息时间戳
- ✅ @提及高亮
- ✅ 消息搜索
- ✅ 表情符号支持 (emoji)

## 🚀 部署

### 生产环境（推荐使用 PM2）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务器并设置开机自启
pm2 start server/index.js --name chat-server
pm2 startup
pm2 save

# 查看状态和日志
pm2 status
pm2 logs chat-server
```

### HTTPS 部署（Nginx 反向代理）

如需通过公网 HTTPS 访问，请参考 [DEPLOYMENT.md](DEPLOYMENT.md) 中的详细配置说明。

### 获取局域网 IP

```bash
# Ubuntu/Linux
ip addr show | grep inet

# Windows
ipconfig

# macOS
ifconfig | grep inet
```

分享 `http://YOUR_IP:3030` 给家人和团队成员使用。

## 📱 家人使用指南

### 1. 访问聊天应用

打开浏览器访问: `http://SERVER_IP:3030`（向管理员获取服务器 IP 地址）

### 2. 注册账号

- 输入用户名（例如: `爸爸`, `妈妈`, `弟弟`）
- 设置密码（建议简单易记）
- 自动进入"大厅"

### 3. 发送消息

- 在输入框输入文本，按 Enter 或点击发送按钮
- 所有大厅成员都能看到

### 4. 私聊

- 点击左侧用户列表中的用户名
- 自动打开私聊窗口
- 仅你们两人可见

### 5. @ 提及 Bot

- 输入 `@gpt-bot 问题` 提及 Bot（如果管理员启用了 Bot）
- Bot 会自动回复

### 移动端使用

**iOS/Android**: 在浏览器访问后，选择"添加到主屏幕"，即可像 App 一样使用。

## 🤖 运行 Bot

### 配置并启动 GPT-4o Bot

```bash
# 进入 bots 目录
cd bots

# 复制环境配置
cp .env.example .env

# 编辑配置文件
nano .env
# 配置 SERVER_URL, BOT_USERNAME, BOT_PASSWORD, FOUNDRY_ENDPOINT, FOUNDRY_API_KEY

# 首次使用需在网页端注册 Bot 账号
# 访问 http://localhost:3030，使用 Bot 用户名密码登录一次

# 启动 Bot
node gpt-bot.js

# 或使用 PM2 后台运行
pm2 start gpt-bot.js --name gpt-bot
```

Bot 会自动登录并在"大厅"中等待 @ 提及。在聊天室发送 `@gpt-bot 你的问题` 即可与 GPT-4o 对话。

## 📊 消息搜索

### 网页端搜索
点击搜索按钮,输入关键词,显示匹配的历史消息。

### API 搜索
```javascript
socket.emit('searchMessages', {
  query: '关键词',
  roomId: 'lobby'  // 可选,限制房间
});

socket.on('searchResults', (results) => {
  console.log(results);
});
```

## 🔧 配置

### 环境变量 (.env)

主服务器配置（根目录 `.env`）:

```env
# 服务器配置
PORT=3030
HOST=0.0.0.0

# JWT 密钥（自动生成，生产环境建议手动设置）
# JWT_SECRET=your-secret-key-here

# 数据库路径（可选）
# DB_PATH=./data/chat.db
```

Bot 配置请参考 `bots/.env.example`。

### 自定义配置

如需修改默认房间、消息长度等，可编辑 `server/index.js` 和 `server/db.js` 中的相关常量。

## 🎯 未来计划

- [ ] 文件传输（图片、文档）
- [ ] 语音/视频通话（WebRTC）
- [ ] 消息编辑和删除
- [ ] 用户权限管理
- [ ] React Native App
- [ ] 消息加密
- [ ] 多服务器同步

## 🐛 故障排除

### 常见问题

**无法连接服务器**
- 检查防火墙: `sudo ufw allow 3030/tcp`
- 确认服务器运行: `pm2 status` 或查看终端输出
- 确认 IP 地址正确: `ip addr show`

**Bot 无法登录**
- 确保 Bot 账号已在网页端注册
- 检查 `bots/.env` 配置是否正确
- 查看 Bot 日志输出

**消息未实时更新**
- 刷新页面重新连接
- 查看浏览器控制台 (F12) 的 WebSocket 连接状态
- 检查服务器日志

**Ubuntu 安装依赖失败**
- 确保已安装构建工具: `sudo apt-get install build-essential python3`
- 删除 node_modules 重试: `rm -rf node_modules && npm install`

更多详细故障排除，请查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 📝 开发指南

### 添加新功能

1. **数据库**: 在 `server/db.js` 添加新表或方法
2. **服务器**: 在 `server/chat.js` 添加 Socket.io 事件处理
3. **客户端**: 在 `public/js/app.js` 添加对应的客户端逻辑
4. **界面**: 在 `public/chat.html` 和 `public/css/style.css` 更新 UI

### 测试

```bash
# 启动服务器
npm start

# 打开多个浏览器窗口测试
# 或使用不同设备测试
```

## 📄 许可证

MIT License - 自由使用和修改

---

**开始使用**: `npm install && npm start`

**问题反馈**: 在项目目录下查看日志或联系开发者
