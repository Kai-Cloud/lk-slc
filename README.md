# 简单局域网聊天系统 (Simple LAN Chat)

一个极简、易用的局域网聊天系统，专为家庭和小团队设计。

## 核心特性

- **极简部署**: 一条命令启动，用户首次登录自动注册
- **实时通信**: WebSocket 实时消息，支持群聊 + 私聊 + @提及
- **Bot 框架**: 内置 Chat Bot（如 gpt-bot）和 Content Bot（如 game-bot）支持
- **多端访问**: 响应式网页，手机可添加到主屏幕当 App 用
- **轻量级**: SQLite 存储，占用 < 50MB RAM，无需外部数据库

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js 22 + Express + Socket.io |
| 前端 | 纯 HTML/CSS/JS + Socket.io Client + i18n |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT + bcrypt |

## 快速开始

```bash
# 克隆并启动
git clone https://github.com/Kai-Cloud/lk-slc.git
cd lk-slc
npm install
npm start          # 生产模式，或 npm run dev 开发模式
```

> Ubuntu 首次安装需要构建工具：`sudo apt-get install -y build-essential python3`

服务器在 `http://localhost:3030` 启动。局域网设备访问 `http://YOUR_IP:3030`。

首次登录输入用户名 + 密码即自动注册，自动进入大厅群聊。

详细步骤见 [QUICK_START.md](QUICK_START.md)。

## 项目结构

```
simple-lan-chat/
├── server/
│   ├── index.js        # 主服务器（Express + Socket.io）
│   ├── db.js           # 数据库 schema 与 prepared statements
│   ├── auth.js         # 登录注册、JWT、密码
│   └── game.js         # 游戏存档 + Bot 事件 + 静态路由
├── public/
│   ├── index.html      # 登录页
│   ├── chat.html       # 聊天页
│   ├── admin.html      # 管理后台
│   ├── css/style.css   # 样式
│   └── js/
│       ├── app.js      # 客户端主逻辑
│       └── i18n.js     # 多语言
├── bots/
│   └── gpt-bot/        # GPT Chat Bot（独立进程）
├── cheatsheet/         # 架构文档（供开发者 / AI agent 参考）
├── data/               # SQLite 数据库文件（运行时生成）
├── .env.example        # 服务器环境变量模板
└── package.json
```

## Bot 系统

slc 支持两类 Bot，通过 `content_url` 元数据区分（不 hardcode 用户名）：

| 类型 | 代表 | 房间行为 | 判断条件 |
|------|------|---------|---------|
| **Chat Bot** | gpt-bot | 正常聊天 UI | `content_url` 为空 |
| **Content Bot** | game-bot | iframe 加载自定义内容 | `content_url` 非空 |

### 启动 gpt-bot

```bash
cd bots/gpt-bot
cp .env.example .env    # 配置 BOT_PASSWORD + FOUNDRY_ENDPOINT + FOUNDRY_API_KEY
node index.js
```

Bot 用户名 = 目录名（`gpt-bot`）。在聊天中 `@gpt-bot 问题` 触发回复，私聊无需 @。

### 创建新 Bot

```bash
cp -r bots/gpt-bot bots/my-bot   # 复制目录，用户名自动为 my-bot
cd bots/my-bot && cp .env.example .env
# 编辑 .env，然后 node index.js
```

更多架构细节见 [cheatsheet/](cheatsheet/) 目录。

## 部署

### PM2 生产运行

```bash
npm install -g pm2
pm2 start server/index.js --name chat-server
pm2 startup && pm2 save    # 开机自启
```

### HTTPS（Nginx 反向代理）

详见 [DEPLOYMENT.md](DEPLOYMENT.md)。

### 获取局域网 IP

```bash
ip addr show    # Linux
ipconfig        # Windows
ifconfig        # macOS
```

## 移动端

1. 手机浏览器访问 `http://服务器IP:3030`
2. iOS: 分享 → 添加到主屏幕；Android: 菜单 → 添加到主屏幕
3. 类似原生 App 体验，无需安装

## 配置

### 服务器 (.env)

```env
PORT=3030           # 监听端口
HOST=0.0.0.0        # 监听地址
# JWT_SECRET=...    # 可选，不填自动生成
# DB_PATH=./data/chat.db
```

### Bot (bots/gpt-bot/.env)

见 `bots/gpt-bot/.env.example`。

## 故障排除

| 问题 | 检查 |
|------|------|
| 局域网无法访问 | 防火墙放行 3030 端口 |
| Bot 登录失败 | 检查 `bots/gpt-bot/.env` 配置 |
| 消息不实时 | F12 查看 WebSocket 状态 |
| 安装依赖失败 | 确认已装 `build-essential python3` |

详细排查见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 相关文档

| 文档 | 内容 |
|------|------|
| [QUICK_START.md](QUICK_START.md) | 5 分钟上手 + 家人使用指南 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 生产部署（PM2 / HTTPS / 多平台） |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 20 个常见问题解决方案 |
| [cheatsheet/](cheatsheet/) | 架构设计文档（开发者参考） |

## 许可证

MIT License
