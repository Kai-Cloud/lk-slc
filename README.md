# 简单局域网聊天系统 (Simple LAN Chat)

一个极简、易用的局域网聊天系统，专为家庭和小团队设计。

## 核心特性

- **极简部署**: 一条命令启动，用户首次登录自动注册
- **实时通信**: WebSocket 实时消息，支持群聊 + 私聊 + @提及
- **多媒体消息**: 支持发送图片（含 GIF）、视频及任意文件（PDF、APK 等），最大 100MB；文本支持超链接自动识别
- **消息管理**: 发送者和接收者均可删除单条消息；私聊支持一键清空聊天记录
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
├── data/               # SQLite 数据库 + 上传文件（运行时生成）
│   └── uploads/        # 用户上传的图片/视频
├── .env.example        # 服务器环境变量模板
└── package.json
```

## 多媒体消息与文件传输

### 支持的文件类型

| 类型 | 格式 | 最大大小 |
|------|------|---------|
| 图片 | JPEG, PNG, GIF, WebP 等 | 100MB |
| 视频 | MP4, WebM 等 | 100MB |
| 文件 | 所有类型（PDF, APK, ZIP, 文档等） | 100MB |
| 文本 | 纯文本消息 | 5000 字符 |

> 不限制文件类型，图片和视频内联预览，其他文件显示为下载链接。

### 发送方式

- **附件按钮** (📎): 点击选择文件上传
- **拖拽上传**: 将文件拖拽到聊天区域
- **粘贴上传**: Ctrl+V / Cmd+V 粘贴剪贴板图片
- **超链接**: 消息中的 URL 自动转为可点击链接

### 消息管理

- **删除消息**: 鼠标悬停消息后点击 🗑️ 按钮，发送者和接收者均可删除
- **清空私聊**: 私聊房间头部 🧹 按钮，一键清空全部聊天记录（含附件文件）
- 删除操作实时同步到房间内所有在线用户

### 存储

上传文件保存在 `data/uploads/` 目录，文件名使用 UUID 防止冲突和路径遍历。原始文件名仅存数据库。

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

如果使用 Nginx 反向代理启用 HTTPS，需要添加以下配置以支持文件上传和 WebSocket：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 允许上传最大 100MB（默认 1MB 会导致上传失败）
    client_max_body_size 100m;

    # 大文件上传超时设置
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;

        # WebSocket 支持（Socket.io 必须）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **重要**: `client_max_body_size` 必须设为 `100m` 或更大，否则 Nginx 会拦截超过 1MB 的文件上传，返回 413 错误（浏览器显示"网络错误"）。

> **重要**: `proxy_set_header Upgrade` 和 `Connection "upgrade"` 是 WebSocket 必需的，缺少会导致 Socket.io 降级为轮询模式。

修改后重载配置：

```bash
sudo nginx -t && sudo nginx -s reload
```

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
| 上传文件"网络错误" | Nginx `client_max_body_size` 设为 `100m` |
| 移动端看不到图库 | 确认 `<input accept="image/*,video/*">` |
| Bot 登录失败 | 检查 `bots/gpt-bot/.env` 配置 |
| 消息不实时 | F12 查看 WebSocket 状态；Nginx 需配置 `Upgrade` 头 |
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
